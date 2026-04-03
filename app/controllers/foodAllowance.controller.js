import FoodAllowance from '../models/foodAllowance.model.js';
import EmployeeAttendance from '../models/employeeAttendance.model.js';
import Employee from '../models/employee.model.js';

// Constant thresholds
const THR_BREAKFAST = "06:30";
const THR_LUNCH = "14:30";
const THR_DINNER = "21:00";

const COST_B = 5;
const COST_L = 12;
const COST_D = 12;

const toMinutes = (time) => {
    if (!time || typeof time !== "string" || !time.includes(":")) return null;
    const [h, m] = time.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return (h * 60) + m;
};

const isWorkingAt = (start, end, target) => {
    if (!start || !end || !target) return false;
    const s = parseInt(start.replace(":", ""));
    const e = parseInt(end.replace(":", ""));
    const t = parseInt(target.replace(":", ""));
    if (e < s) {
        // Over midnight
        return t >= s || t <= e;
    }
    return t >= s && t <= e;
};

// True when any part of the shift is at/after a threshold within the same workday evening window.
const isWorkingAtOrAfter = (start, end, threshold) => {
    const s = toMinutes(start);
    let e = toMinutes(end);
    const t = toMinutes(threshold);
    if (s === null || e === null || t === null) return false;
    if (s === e) return false;

    // Shift crosses midnight
    if (e <= s) e += 24 * 60;

    // Check overlap with [threshold, 24:00] on the shift's start day.
    return e >= t && s <= (24 * 60);
};

export const getFoodReport = async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ message: "Dates required" });

    // 1. Get raw attendance records
    const attendanceRecords = await EmployeeAttendance.find({
      date: { $gte: from, $lte: to }
    }).lean();

    // 2. Get manual overrides in range
    const overrides = await FoodAllowance.find({
      date: { $gte: from, $lte: to }
    }).lean();

    // 3. Get all employees to map usernames to codes (case-insensitive & trimmed keys)
    const employees = await Employee.find({}, 'username employeeCode').lean();
    const codeMap = new Map();
    employees.forEach(e => {
        if (e.username) {
            const cleanUser = String(e.username).trim().toLowerCase();
            codeMap.set(cleanUser, e.employeeCode);
        }
    });

    const report = [];
    const overrideMap = new Map();
    overrides.forEach(ov => overrideMap.set(`${ov.date}_${ov.employeeUsername}`, ov));

    // Process attendance records
    for (const att of attendanceRecords) {
      const uKey = String(att.employeeUsername || "").trim().toLowerCase();
      const employeeCode = codeMap.get(uKey) || "—";
      
      const key = `${att.date}_${att.employeeUsername}`;
      const over = overrideMap.get(key);

      if (over) {
        report.push({
          _id: over._id,
          isManual: true,
          date: over.date,
          employeeUsername: over.employeeUsername,
          employeeCode,
          employeeName: over.employeeName || att.employeeName,
          jobNumber: over.jobNumber || att.site1JobNumber || att.jobNumber || "—",
          projectName: over.projectName || att.projectName || att.site1ProjectName || "—",
          breakfast: over.breakfast || 0,
          lunch: over.lunch || 0,
          dinner: over.dinner || 0,
          advance: over.advance || 0,
          notes: over.notes || "—",
          total: over.total || 0,
          displayTimes: "Manual Override"
        });
      } else {
        let b = 0, l = 0, d = 0;
        
        let hasB = false, hasL = false, hasD = false;
        const jobNumbers = new Set();
        const projects = new Set();
        const timeLog = [];

        const processRound = (entry, exit, sourceAtt, pLabel = "") => {
            if (!entry || !exit) return;
            
            const workingB_start = isWorkingAt(entry, exit, "06:45");
            const workingB_end = isWorkingAt(entry, exit, "09:00");
            const workingL = isWorkingAt(entry, exit, THR_LUNCH);
            const workingD = isWorkingAtOrAfter(entry, exit, THR_DINNER);

            if (workingB_start && workingB_end) hasB = true;
            if (workingL) hasL = true;
            if (workingD) hasD = true;

            timeLog.push(`${pLabel}${entry}-${exit}`);

            // Collect job numbers/projects
            if (sourceAtt === att) {
                if (att.jobNumber) jobNumbers.add(String(att.jobNumber));
                if (att.projectName) projects.add(String(att.projectName));
                for (let i = 1; i <= 6; i++) {
                    if (att[`site${i}JobNumber`]) jobNumbers.add(String(att[`site${i}JobNumber`]));
                    const pName = att[`site${i}ProjectName`] || att[`site${i}Location`];
                    if (pName) projects.add(String(pName));
                }
            }
        };

        // R1
        processRound(att.officeEntryTime, att.officeExitTime, att, "R1:");

        // R2 - R5
        ['s2_', 's3_', 's4_', 's5_'].forEach((p, idx) => {
            const entry = att[`${p}officeEntryTime`];
            const exit = att[`${p}officeExitTime`];
            if (entry && exit) {
                processRound(entry, exit, {}, `R${idx+2}:`);

                for (let i = 1; i <= 6; i++) {
                    if (att[`${p}site${i}JobNumber`]) jobNumbers.add(String(att[`${p}site${i}JobNumber`]));
                    const pName = att[`${p}site${i}ProjectName`] || att[`${p}site${i}Location`];
                    if (pName) projects.add(String(pName));
                }
            }
        });

        if (hasB) b = COST_B;
        if (hasL) l = COST_L;
        if (hasD) d = COST_D;

        // Check if there is a FoodAllowance doc just for advance or notes
        const foodDoc = overrideMap.get(key);
        const adv = foodDoc ? (foodDoc.advance || 0) : 0;
        const notes = foodDoc ? (foodDoc.notes || "—") : "—";

        report.push({
          isManual: false,
          date: att.date,
          employeeUsername: att.employeeUsername,
          employeeCode,
          employeeName: att.employeeName,
          jobNumber: Array.from(jobNumbers).join(", ") || "—",
          projectName: Array.from(projects).join(", ") || "—",
          breakfast: b,
          lunch: l,
          dinner: d,
          advance: adv,
          notes,
          total: b + l + d,
          displayTimes: timeLog.join(" | ")
        });
      }
    }

    res.status(200).json(report.sort((a,b) => b.date.localeCompare(a.date)));
  } catch (err) {
    console.error("[FoodReport] Error:", err);
    res.status(500).json({ message: err.message });
  }
};

export const updateFoodEntry = async (req, res) => {
  try {
    const { date, employeeUsername, breakfast, lunch, dinner, advance, notes } = req.body;
    let { employeeName } = req.body;
    if(!employeeName) {
        const emp = await Employee.findOne({ username: employeeUsername });
        employeeName = emp ? emp.name : employeeUsername;
    }

    const total = (breakfast || 0) + (lunch || 0) + (dinner || 0);

    const update = {
      employeeName,
      breakfast: breakfast || 0,
      lunch: lunch || 0,
      dinner: dinner || 0,
      advance: advance || 0,
      notes,
      total,
      isManual: true
    };

    const doc = await FoodAllowance.findOneAndUpdate(
      { date, employeeUsername },
      update,
      { upsert: true, new: true, returnDocument: 'after' }
    );

    res.status(200).json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteFoodEntry = async (req, res) => {
  try {
    await FoodAllowance.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

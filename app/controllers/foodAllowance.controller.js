import FoodAllowance from '../models/foodAllowance.model.js';
import EmployeeAttendance from '../models/employeeAttendance.model.js';
import WorkSchedule from '../models/workSchedule.model.js';
import User from '../models/user.model.js';
import Employee from '../models/employee.model.js';
import {
  buildEmployeeResolverByEmployeeCode,
  findEmployeeByCode,
} from '../utils/employeeResolver.js';

const cleanLabel = (v) => {
  const s = String(v || '').trim();
  if (!s || s === '-' || s === '—') return '';
  return s;
};

const formatScheduleProject = (sch) => {
  const job = cleanLabel(sch?.jobNumber);
  const proj = cleanLabel(sch?.projectName);
  if (job && proj) return `${job} - ${proj}`;
  return proj || job || '';
};

/** Pull project names from every site/round field on an attendance document. */
function collectProjectsAndJobsFromAttendance(att) {
  const projects = new Set();
  const jobNumbers = new Set();

  const addProject = (v) => {
    const s = cleanLabel(v);
    if (s) projects.add(s);
  };
  const addJob = (v) => {
    const s = cleanLabel(v);
    if (s) jobNumbers.add(s);
  };

  addProject(att.projectName);
  addJob(att.jobNumber);

  for (let i = 1; i <= 6; i++) {
    addProject(att[`site${i}ProjectName`]);
    addProject(att[`site${i}Location`]);
    addJob(att[`site${i}JobNumber`]);
  }

  for (const prefix of ['s2_', 's3_', 's4_', 's5_']) {
    for (let i = 1; i <= 6; i++) {
      addProject(att[`${prefix}site${i}ProjectName`]);
      addProject(att[`${prefix}site${i}Location`]);
      addJob(att[`${prefix}site${i}JobNumber`]);
    }
  }

  for (const [key, val] of Object.entries(att || {})) {
    if (/projectname/i.test(key)) addProject(val);
    if (/jobnumber/i.test(key) && !/submit/i.test(key)) addJob(val);
  }

  return { projects, jobNumbers };
}

/** When attendance has no site project, use that day's deploy schedule for the employee. */
async function collectProjectsFromSchedule(att) {
  const projects = new Set();
  const jobNumbers = new Set();
  const date = att?.date;
  if (!date) return { projects, jobNumbers };

  const code = cleanLabel(att.employeeCode);
  const or = [];
  if (code) {
    or.push({ assignedToEmployeeCode: code });
    or.push({ assignedToEmployeeCode: { $regex: new RegExp(`^${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
  }

  const emp = code ? await findEmployeeByCode(code) : null;
  if (emp?.id != null) or.push({ assignedToEmployeeId: emp.id });
  if (att.employeeId != null) or.push({ assignedToEmployeeId: att.employeeId });

  if (or.length === 0) return { projects, jobNumbers };

  const schedules = await WorkSchedule.find({ taskDate: date, $or: or })
    .select({ projectName: 1, jobNumber: 1 })
    .lean();

  for (const sch of schedules) {
    const label = formatScheduleProject(sch);
    if (label) projects.add(label);
    const job = cleanLabel(sch.jobNumber);
    if (job) jobNumbers.add(job);
  }

  return { projects, jobNumbers };
}

async function resolveEmployeeForLegacyRow(row) {
  const code = cleanLabel(row?.employeeCode);
  if (code) {
    const emp = await findEmployeeByCode(code);
    if (emp) return emp;
  }

  // Legacy food/attendance rows store login User.id in employeeId
  const userId = Number(row?.employeeId);
  if (!Number.isFinite(userId)) return null;

  const user = await User.findOne({ id: userId }).select({ username: 1 }).lean();
  if (!user?.username) return null;

  const emp = await Employee.findOne({ username: user.username })
    .select({ id: 1, name: 1, shortName: 1, employeeCode: 1, username: 1 })
    .lean();
  return emp || null;
}

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

    const report = [];
    const overrideMap = new Map();
    overrides.forEach(ov => overrideMap.set(`${ov.date}_${ov.employeeId}`, ov));

    // Process attendance records
    for (const att of attendanceRecords) {
      const key = `${att.date}_${att.employeeId}`;
      const over = overrideMap.get(key);

      if (over) {
        report.push({
          _id: over._id,
          isManual: true,
          date: over.date,
          employeeId: over.employeeId,
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
        const fromAtt = collectProjectsAndJobsFromAttendance(att);
        const jobNumbers = fromAtt.jobNumbers;
        const projects = fromAtt.projects;
        const timeLog = [];

        const processRound = (entry, exit, pLabel = "") => {
            if (!entry) return;
            const effectiveExit = exit || "00:00";
            
            const workingB_start = isWorkingAt(entry, effectiveExit, "06:45");
            const workingB_end = isWorkingAt(entry, effectiveExit, "09:00");
            const workingL = isWorkingAt(entry, effectiveExit, THR_LUNCH);
            const workingD = isWorkingAtOrAfter(entry, effectiveExit, THR_DINNER);

            if (workingB_start && workingB_end) hasB = true;
            if (workingL) hasL = true;
            if (workingD) hasD = true;

            timeLog.push(`${pLabel}${entry}-${effectiveExit}`);
        };

        // R1
        processRound(att.officeEntryTime, att.officeExitTime, "R1:");

        // R2 - R5
        ['s2_', 's3_', 's4_', 's5_'].forEach((p, idx) => {
            const entry = att[`${p}officeEntryTime`];
            const exit = att[`${p}officeExitTime`];
            if (entry) processRound(entry, exit, `R${idx + 2}:`);
        });

        if (projects.size === 0) {
          const fromSchedule = await collectProjectsFromSchedule(att);
          fromSchedule.projects.forEach((p) => projects.add(p));
          fromSchedule.jobNumbers.forEach((j) => jobNumbers.add(j));
        }

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
          employeeId: att.employeeId,
          employeeCode: String(att.employeeCode || '').trim(),
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

    const processedKeys = new Set(report.map((r) => `${r.date}_${r.employeeId}`));
    for (const ov of overrides) {
      const key = `${ov.date}_${ov.employeeId}`;
      if (processedKeys.has(key)) continue;
      report.push({
        _id: ov._id,
        isManual: true,
        date: ov.date,
        employeeId: ov.employeeId,
        jobNumber: ov.jobNumber || '—',
        projectName: ov.projectName || '—',
        breakfast: ov.breakfast || 0,
        lunch: ov.lunch || 0,
        dinner: ov.dinner || 0,
        advance: ov.advance || 0,
        notes: ov.notes || '—',
        total: ov.total || (ov.breakfast || 0) + (ov.lunch || 0) + (ov.dinner || 0),
        displayTimes: 'Manual entry (no attendance)',
      });
      processedKeys.add(key);
    }

    const resolveEmp = await buildEmployeeResolverByEmployeeCode();

    const enriched = await Promise.all(report.map(async (row) => {
      let codeRef = String(row.employeeCode || '').trim();
      let emp = codeRef ? resolveEmp(codeRef) : null;
      if (!emp) {
        const legacy = await resolveEmployeeForLegacyRow(row);
        if (legacy?.employeeCode) {
          codeRef = String(legacy.employeeCode).trim();
          emp = legacy;
        }
      }
      const name = (emp?.shortName || emp?.name || '').trim();
      const code = (emp?.employeeCode || codeRef || '').trim();

      let projectName = row.projectName;
      if (!cleanLabel(projectName)) {
        const fromSch = await collectProjectsFromSchedule({
          date: row.date,
          employeeId: row.employeeId,
          employeeCode: code,
        });
        const labels = [...fromSch.projects];
        projectName = labels.length ? labels.join(', ') : '—';
      }

      let jobNumber = row.jobNumber;
      if (!cleanLabel(jobNumber) || jobNumber === '—') {
        const fromSch = await collectProjectsFromSchedule({
          date: row.date,
          employeeId: row.employeeId,
          employeeCode: code,
        });
        const jobs = [...fromSch.jobNumbers];
        if (jobs.length) jobNumber = jobs.join(', ');
      }

      return {
        ...row,
        employeeName: name || '—',
        employeeCode: code || '—',
        employeeShortName: emp?.shortName || name || '',
        projectName: cleanLabel(projectName) || '—',
        jobNumber: cleanLabel(jobNumber) || row.jobNumber || '—',
      };
    }));

    res.status(200).json(enriched.sort((a, b) => b.date.localeCompare(a.date)));
  } catch (err) {
    console.error("[FoodReport] Error:", err);
    res.status(500).json({ message: err.message });
  }
};

export const updateFoodEntry = async (req, res) => {
  try {
    const { date, employeeId, breakfast, lunch, dinner, advance, notes } = req.body;

    const total = (breakfast || 0) + (lunch || 0) + (dinner || 0);

    const update = {
      breakfast: breakfast || 0,
      lunch: lunch || 0,
      dinner: dinner || 0,
      advance: advance || 0,
      notes,
      total,
      isManual: true
    };

    const doc = await FoodAllowance.findOneAndUpdate(
      { date, employeeId },
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

import Attendance from '../models/attendance.model.js';
import EmployeeAttendance from '../models/employeeAttendance.model.js';
import WorkSchedule from '../models/workSchedule.model.js';
import { attendanceDocToRow, docToObject } from '../utils/helpers.js';

export const getAttendance = async (req, res) => {
  try {
    const data = await Attendance.find().sort({ date: 1 }).lean();
    const rows = data.map(attendanceDocToRow);
    if (req.user.role === 'admin') return res.json(rows);
    return res.json(rows.map((r) => ({ date: r.date, status: r[req.user.name] || '' })));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const getAttendanceByDate = async (req, res) => {
  try {
    const record = await Attendance.findOne({ date: String(req.params.date).trim() }).lean();
    if (!record) return res.json({});
    const { date, ...rest } = attendanceDocToRow(record);
    return res.json(rest);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const updateAttendance = async (req, res) => {
  try {
    const { date, studentName, status } = req.body;
    if (!date || !studentName || !status) return res.status(400).json({ message: 'Required fields missing' });
    let record = await Attendance.findOne({ date: String(date).trim() });
    if (!record) record = new Attendance({ date: String(date).trim(), entries: {} });
    record.entries.set(String(studentName), String(status));
    await record.save();
    return res.json({ message: 'Updated', row: attendanceDocToRow(record) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const lookupScheduleByJobNumber = async (jobNumber, date) => {
  if (!jobNumber) return null;
  const query = { jobNumber: String(jobNumber).trim() };
  if (date) query.date = date;
  
  // Try matching date first, then fall back to most recent
  let match = await WorkSchedule.findOne(query).sort({ date: -1 }).lean();
  if (!match && date) {
    match = await WorkSchedule.findOne({ jobNumber: String(jobNumber).trim() }).sort({ date: -1 }).lean();
  }
  return match;
};

export const jobLookup = async (req, res) => {
  try {
    const { jobNumber } = req.params;
    const { date } = req.query; // Accept optional date
    const schedule = await lookupScheduleByJobNumber(jobNumber, date);
    if (!schedule) return res.status(404).json({ message: 'Job not found' });
    return res.json({
      projectName: schedule.projectName,
      customerName: schedule.customerName,
      location: schedule.siteLocationName,
      vehicle: schedule.vehicle
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const enrichAttendanceWithSchedule = async (req, res) => {
  try {
    const records = await EmployeeAttendance.find().lean();
    let updatedCount = 0;

    for (const record of records) {
      const updates = {};
      
      // 1. Check top-level jobNumber if it exists, fall back to site1JobNumber
      const mainJob = String(record.jobNumber || record.site1JobNumber || '').trim();
      if (mainJob) {
        const schedule = await lookupScheduleByJobNumber(mainJob, record.date);
        if (schedule) {
          if (!record.projectName) updates.projectName = schedule.projectName || '';
          if (!record.customerName) updates.customerName = schedule.customerName || '';
          if (!record.vehicle) updates.vehicle = schedule.vehicle || '';
        }
      }

      // 2. Check site-specific jobNumbers
      let i = 1;
      while (i <= 10) {
        const jobNum = String(record[`site${i}JobNumber`] || '').trim();
        if (jobNum) {
          const schedule = await lookupScheduleByJobNumber(jobNum, record.date);
          if (schedule) {
            if (!record[`site${i}ProjectName`]) updates[`site${i}ProjectName`] = schedule.projectName || '';
            if (!record[`site${i}CustomerName`]) updates[`site${i}CustomerName`] = schedule.customerName || '';
            if (!record[`site${i}Vehicle`]) updates[`site${i}Vehicle`] = schedule.vehicle || '';
            // For legacy top-level vehicle if missing
            if (schedule.vehicle && !updates.vehicle && !record.vehicle) {
              updates.vehicle = schedule.vehicle;
            }
          }
        }
        // Even if site<i>JobNumber is missing, we check if they have site<i>Location to continue
        // safer to just loop fixed 10 times or check next
        if (record[`site${i+1}JobNumber`] === undefined && record[`site${i+1}Location`] === undefined && i > 3) break;
        i++;
      }

      if (Object.keys(updates).length > 0) {
        await EmployeeAttendance.updateOne({ _id: record._id }, { $set: updates });
        updatedCount++;
      }
    }

    return res.json({ message: `Enriched ${updatedCount} records` });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const logEmployeeAttendance = async (req, res) => {
  try {
    const { date, officeEntryTime, officeExitTime, jobNumber, ...rest } = req.body;
    if (!date || !officeEntryTime) return res.status(400).json({ message: 'Date and entry time required' });
    const exists = await EmployeeAttendance.findOne({ date, employeeUsername: req.user.username }).lean();
    if (exists) return res.status(400).json({ message: 'Already recorded' });
    const payload = {
      date,
      employeeUsername: req.user.username,
      employeeName: req.user.name || req.user.username,
      officeEntryTime,
      officeExitTime: officeExitTime || '',
      jobNumber: String(jobNumber || '').trim(),
    };
    Object.keys(rest).forEach((k) => { if (k.startsWith('site')) payload[k] = rest[k]; });

    // Enrich top-level jobNumber (fallback to site1)
    const effectiveJob = String(payload.jobNumber || payload.site1JobNumber || '').trim();
    if (effectiveJob) {
      const mainSchedule = await lookupScheduleByJobNumber(effectiveJob, payload.date);
      if (mainSchedule) {
        payload.projectName = mainSchedule.projectName || payload.projectName || '';
        payload.customerName = mainSchedule.customerName || payload.customerName || '';
        payload.vehicle = mainSchedule.vehicle || payload.vehicle || '';
      }
    }

    // Enrich missing fields dynamically
    let i = 1;
    while (payload[`site${i}JobNumber`] !== undefined || payload[`site${i}Location`] !== undefined) {
      const jobNum = String(payload[`site${i}JobNumber`] || '').trim();
      if (jobNum) {
        const schedule = await lookupScheduleByJobNumber(jobNum, payload.date);
        if (schedule) {
          payload[`site${i}ProjectName`] = schedule.projectName || payload[`site${i}ProjectName`] || '';
          payload[`site${i}CustomerName`] = schedule.customerName || payload[`site${i}CustomerName`] || '';
          payload[`site${i}Vehicle`] = schedule.vehicle || payload[`site${i}Vehicle`] || '';
          if (schedule.vehicle && !payload.vehicle) {
            payload.vehicle = schedule.vehicle;
          }
        }
      }
      i++;
    }

    const record = await EmployeeAttendance.create(payload);
    return res.json(docToObject(record));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const updateEmployeeAttendance = async (req, res) => {
  try {
    const { date, officeEntryTime, officeExitTime, jobNumber, ...rest } = req.body;
    const current = await EmployeeAttendance.findOne({ date, employeeUsername: req.user.username });
    if (!current) return res.status(404).json({ message: 'Record not found' });
    current.officeEntryTime = officeEntryTime || '';
    current.officeExitTime = officeExitTime || '';
    current.jobNumber = String(jobNumber || '').trim();
    Object.keys(current.toObject()).forEach((k) => { if (k.startsWith('site')) current.set(k, undefined); });
    
    const tempPayload = {};
    Object.keys(rest).forEach((k) => { if (k.startsWith('site')) tempPayload[k] = rest[k]; });

    // Enrich missing site details dynamically
    let i = 1;
    while (tempPayload[`site${i}JobNumber`] !== undefined || tempPayload[`site${i}Location`] !== undefined) {
      const jobNum = String(tempPayload[`site${i}JobNumber`] || '').trim();
      if (jobNum) {
        const schedule = await lookupScheduleByJobNumber(jobNum, current.date);
        if (schedule) {
          tempPayload[`site${i}ProjectName`] = schedule.projectName || tempPayload[`site${i}ProjectName`] || '';
          tempPayload[`site${i}CustomerName`] = schedule.customerName || tempPayload[`site${i}CustomerName`] || '';
          tempPayload[`site${i}Vehicle`] = schedule.vehicle || tempPayload[`site${i}Vehicle`] || '';
        }
      }
      i++;
    }

    Object.keys(tempPayload).forEach((k) => { current.set(k, tempPayload[k]); });

    // Enrich top-level details (fallback to site1)
    const effectiveJob = String(current.jobNumber || current.site1JobNumber || '').trim();
    if (effectiveJob) {
      const mainSchedule = await lookupScheduleByJobNumber(effectiveJob, current.date);
      if (mainSchedule) {
        if (!current.projectName) current.projectName = mainSchedule.projectName || '';
        if (!current.customerName) current.customerName = mainSchedule.customerName || '';
        if (!current.vehicle) current.vehicle = mainSchedule.vehicle || '';
      }
    }

    await current.save();
    return res.json(docToObject(current));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const adminUpdateEmployeeAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;
    const record = await EmployeeAttendance.findById(id);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    
    // Reset sites if provided in payload
    if (Object.keys(payload).some(k => k.startsWith('site'))) {
      const obj = record.toObject();
      Object.keys(obj).forEach(k => { if (k.startsWith('site')) record.set(k, undefined); });
    }

    Object.assign(record, payload);
    await record.save();
    return res.json(docToObject(record));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const deleteEmployeeAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    await EmployeeAttendance.findByIdAndDelete(id);
    return res.json({ message: 'Record deleted' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const getAllEmployeeAttendance = async (req, res) => {
  try {
    const data = await EmployeeAttendance.find().sort({ date: -1, createdAt: -1 }).lean();
    return res.json(data.map(docToObject));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const getEmployeeAttendanceByDate = async (req, res) => {
  try {
    const { date } = req.params;
    const record = await EmployeeAttendance.findOne({ date, employeeUsername: req.user.username }).lean();
    return res.json(record ? docToObject(record) : null);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const getEmployeeAttendanceHistory = async (req, res) => {
  try {
    const data = await EmployeeAttendance.find({ employeeUsername: req.user.username })
      .sort({ date: -1, createdAt: -1 })
      .limit(50)
      .lean();
    return res.json(data.map(docToObject));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const updateBreakMinutes = async (req, res) => {
  try {
    const { date, employeeUsername, breakMinutes } = req.body;
    if (!date || !employeeUsername) return res.status(400).json({ message: 'date and employeeUsername required' });
    const mins = Math.max(0, Number(breakMinutes) || 0);
    const record = await EmployeeAttendance.findOneAndUpdate(
      { date, employeeUsername },
      { $set: { breakMinutes: mins } },
      { new: true }
    ).lean();
    if (!record) return res.status(404).json({ message: 'Attendance record not found' });
    return res.json({ date: record.date, employeeUsername: record.employeeUsername, breakMinutes: record.breakMinutes });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

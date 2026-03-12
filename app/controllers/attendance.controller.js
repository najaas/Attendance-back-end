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

export const lookupScheduleByJobNumber = async (jobNumber) => {
  if (!jobNumber) return null;
  const inputParts = jobNumber.split(',').map((j) => j.trim()).filter(Boolean);
  let schedule = null;

  for (const part of inputParts) {
    schedule = await WorkSchedule.findOne({ jobNumber: part }).sort({ createdAt: -1 }).lean();
    if (schedule) break;
    schedule = await WorkSchedule.findOne({
      jobNumber: { $regex: part, $options: 'i' },
    }).sort({ createdAt: -1 }).lean();
    if (schedule) break;
  }

  if (!schedule) {
    schedule = await WorkSchedule.findOne({ jobNumber }).sort({ createdAt: -1 }).lean();
  }

  if (!schedule) {
    schedule = await WorkSchedule.findOne({
      jobNumber: { $regex: jobNumber, $options: 'i' },
    }).sort({ createdAt: -1 }).lean();
  }

  return schedule;
};

export const jobLookup = async (req, res) => {
  try {
    const jobNumber = String(req.params.jobNumber || '').trim();
    if (!jobNumber) return res.json(null);

    const schedule = await lookupScheduleByJobNumber(jobNumber);
    if (!schedule) return res.json(null);

    return res.json({
      projectName: schedule.projectName || '',
      customerName: schedule.customerName || '',
      jobNumber: schedule.jobNumber || '',
      site: schedule.site || '',
      location: schedule.location || '',
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
      let i = 1;

      while (record[`site${i}JobNumber`] !== undefined || record[`site${i}Location`] !== undefined) {
        const jobNum = String(record[`site${i}JobNumber`] || '').trim();
        const alreadyHasProject = String(record[`site${i}ProjectName`] || '').trim();

        if (jobNum && !alreadyHasProject) {
          const parts = jobNum.split(',').map((j) => j.trim()).filter(Boolean);
          let schedule = null;

          for (const part of parts) {
            schedule = await WorkSchedule.findOne({ jobNumber: part }).sort({ createdAt: -1 }).lean();
            if (schedule) break;
            schedule = await WorkSchedule.findOne({
              jobNumber: { $regex: part, $options: 'i' },
            }).sort({ createdAt: -1 }).lean();
            if (schedule) break;
          }

          if (!schedule) {
            schedule = await WorkSchedule.findOne({
              jobNumber: { $regex: jobNum, $options: 'i' },
            }).sort({ createdAt: -1 }).lean();
          }

          if (schedule) {
            updates[`site${i}ProjectName`] = schedule.projectName || '';
            updates[`site${i}CustomerName`] = schedule.customerName || '';
          }
        }
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

    // Enrich missing fields dynamically
    let i = 1;
    while (payload[`site${i}JobNumber`] !== undefined || payload[`site${i}Location`] !== undefined) {
      const jobNum = String(payload[`site${i}JobNumber`] || '').trim();
      if (jobNum) {
        const schedule = await lookupScheduleByJobNumber(jobNum);
        if (schedule) {
          payload[`site${i}ProjectName`] = schedule.projectName || payload[`site${i}ProjectName`] || '';
          payload[`site${i}CustomerName`] = schedule.customerName || payload[`site${i}CustomerName`] || '';
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

    // Enrich missing fields dynamically
    let i = 1;
    while (tempPayload[`site${i}JobNumber`] !== undefined || tempPayload[`site${i}Location`] !== undefined) {
      const jobNum = String(tempPayload[`site${i}JobNumber`] || '').trim();
      if (jobNum) {
        const schedule = await lookupScheduleByJobNumber(jobNum);
        if (schedule) {
          tempPayload[`site${i}ProjectName`] = schedule.projectName || tempPayload[`site${i}ProjectName`] || '';
          tempPayload[`site${i}CustomerName`] = schedule.customerName || tempPayload[`site${i}CustomerName`] || '';
        }
      }
      i++;
    }

    Object.keys(tempPayload).forEach((k) => { current.set(k, tempPayload[k]); });

    await current.save();
    return res.json(docToObject(current));
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

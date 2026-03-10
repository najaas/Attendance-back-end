import Attendance from '../models/attendance.model.js';
import EmployeeAttendance from '../models/employeeAttendance.model.js';
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
      officeEntryTime, officeExitTime: officeExitTime || '',
      jobNumber: String(jobNumber || '').trim()
    };
    Object.keys(rest).forEach(k => { if (k.startsWith('site')) payload[k] = rest[k]; });

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

    Object.keys(current.toObject()).forEach(k => { if (k.startsWith('site')) current.set(k, undefined); });
    Object.keys(rest).forEach(k => { if (k.startsWith('site')) current.set(k, rest[k]); });

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



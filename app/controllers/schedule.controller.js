import mongoose from 'mongoose';
import WorkSchedule from '../models/workSchedule.model.js';
import Employee from '../models/employee.model.js';
import { getNextId, getLocalDateString, docToObject } from '../utils/helpers.js';
import { notifyScheduleAssigned } from '../utils/pushNotifications.js';
import { resolveScheduleAssignees, resolveEmployeeForScheduleRow } from '../utils/employeeResolver.js';

async function enrichSchedulesWithEmployeeNames(schedules) {
  if (!Array.isArray(schedules) || schedules.length === 0) return [];

  const empByKey = new Map();
  await Promise.all(
    schedules.map(async (s) => {
      const key = String(s.assignedToEmployeeCode || s.assignedToEmployeeId || '');
      if (!key || empByKey.has(key)) return;
      const emp = await resolveEmployeeForScheduleRow(s);
      if (emp) empByKey.set(key, emp);
    })
  );

  return schedules.map((s) => {
    const key = String(s.assignedToEmployeeCode || s.assignedToEmployeeId || '');
    const emp = empByKey.get(key);
    const display = emp?.shortName || emp?.name || '';
    return {
      ...docToObject(s),
      vehicle: String(s.vehicle || '').trim(),
      location: String(s.location || '').trim(),
      customerContact: String(s.customerContact || '').trim(),
      customerPerson: String(s.customerPerson || '').trim(),
      assignedToName: emp?.name || display,
      assignedToShortName: emp?.shortName || display,
      assignedToEmployeeCode: emp?.employeeCode || '',
      assignedToUsername: emp?.username || '',
    };
  });
}

export const getSchedules = async (req, res) => {
  try {
    const rawDate = String(req.query?.date || '').trim();
    const lite = String(req.query?.lite || '').trim() === '1';
    if (lite) res.set('Cache-Control', 'private, max-age=15');
    const requestedDate = rawDate || getLocalDateString();
    let query = {};

    if (requestedDate.toLowerCase() === 'all') {
      query = {};
    } else if (requestedDate === 'recent') {
      const today = new Date();
      const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
      query = { taskDate: { $in: [getLocalDateString(yesterday), getLocalDateString(today), getLocalDateString(tomorrow)] } };
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
      query = { taskDate: requestedDate };
    } else {
      query = { taskDate: getLocalDateString() };
    }

    let q = WorkSchedule.find(query).sort({ taskDate: 1, createdAt: -1 });
    if (lite) {
      q = q.select({
        _id: 1,
        id: 1,
        taskDate: 1,
        title: 1,
        description: 1,
        jobNumber: 1,
        projectName: 1,
        customerName: 1,
        location: 1,
        site: 1,
        vehicle: 1,
        assignedToEmployeeId: 1,
        status: 1,
        createdAt: 1,
      });
    }
    const schedules = await q.lean();
    return res.json(await enrichSchedulesWithEmployeeNames(schedules));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const getAllSchedules = async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const collection = db.collection('workschedules');
    const schedules = await collection.find({}).sort({ createdAt: -1 }).toArray();
    console.log('[Backend] Direct MongoDB find found', schedules.length, 'records');
    const normalized = schedules.map((s) => {
      const obj = { ...s };
      delete obj._id;
      return obj;
    });
    return res.json(await enrichSchedulesWithEmployeeNames(normalized));
  } catch (err) {
    console.error('[Backend] Error in getAllSchedules:', err);
    return res.status(500).json({ message: err.message });
  }
};

export const addSchedule = async (req, res) => {
  try {
    const { title, description, taskDate, site, assignedTo, assignedToEmployeeIds } = req.body;
    const location = String(req.body?.location || req.body?.taskLocation || '').trim();
    const vehicle = String(req.body?.vehicle || '').trim();
    const officeTime = String(req.body?.officeTime || '').trim();
    const siteTime = String(req.body?.siteTime || '').trim();
    const jobNumber = String(req.body?.jobNumber || '').trim();
    const projectName = String(req.body?.projectName || '').trim();
    const customerName = String(req.body?.customerName || '').trim();
    const customerPerson = String(req.body?.customerPerson || '').trim();
    const customerContact = String(req.body?.customerContact || '').trim();
    const remarks = String(req.body?.remarks || '').trim();
    const assignMode = String(assignedTo || '').trim();

    if (!title?.trim() || !assignMode) return res.status(400).json({ message: 'Title and assignee required' });

    const assignees = await resolveScheduleAssignees(assignMode, assignedToEmployeeIds);
    if (assignees.length === 0) {
      return res.status(400).json({
        message: 'No valid employees selected. Pick staff again or check employee codes in Admin → Employees.',
      });
    }

    const assignedBy = Number(req.user?.id);
    if (!Number.isFinite(assignedBy)) {
      return res.status(401).json({ message: 'Invalid admin session. Please log in again.' });
    }

    const firstId = await getNextId(WorkSchedule, 0);
    const docs = assignees.map((a, idx) => ({
      id: firstId + idx,
      title: title.trim(),
      description: (description || '').trim(),
      jobNumber, projectName, customerName, customerPerson, customerContact,
      taskDate: taskDate || getLocalDateString(),
      location, site: (site || 'All Sites').trim(), vehicle,
      officeTime, siteTime,
      remarks,
      assignedToEmployeeId: a.employeeId,
      assignedToEmployeeCode: a.employeeCode,
      assignedByEmployeeId: assignedBy, status: 'pending', statusDate: taskDate || getLocalDateString()
    }));

    const created = await WorkSchedule.insertMany(docs);
    let push = { sent: 0 };
    try {
      push = await notifyScheduleAssigned({ schedules: created.map((s) => docToObject(s)) });
      console.log('[push] schedule notify sent:', push.sent);
    } catch (err) {
      console.error('[push] schedule notify failed:', err.message);
    }
    return res.json({ count: created.length, tasks: created.map(s => docToObject(s)), push });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      description, site, vehicle, location, officeTime, siteTime,
      jobNumber, projectName, customerName, customerPerson, customerContact,
      status, statusDate, remarks
    } = req.body;

    const schedule = await WorkSchedule.findOne({ id: Number(id) });
    if (!schedule) return res.status(404).json({ message: 'Schedule not found' });

    if (description !== undefined) schedule.description = description;
    if (site !== undefined) schedule.site = site;
    if (vehicle !== undefined) schedule.vehicle = vehicle;
    if (location !== undefined) schedule.location = location;
    if (officeTime !== undefined) schedule.officeTime = officeTime;
    if (siteTime !== undefined) schedule.siteTime = siteTime;
    if (jobNumber !== undefined) schedule.jobNumber = jobNumber;
    if (projectName !== undefined) schedule.projectName = projectName;
    if (customerName !== undefined) schedule.customerName = customerName;
    if (customerPerson !== undefined) schedule.customerPerson = customerPerson;
    if (customerContact !== undefined) schedule.customerContact = customerContact;
    if (status !== undefined) {
      if (schedule.status !== status && !statusDate) {
        schedule.statusDate = getLocalDateString();
      }
      schedule.status = status;
    }
    if (statusDate) schedule.statusDate = statusDate;
    if (remarks !== undefined) schedule.remarks = remarks;

    await schedule.save();
    return res.json(docToObject(schedule));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const schedule = await WorkSchedule.findOneAndDelete({ id: Number(id) });
    if (!schedule) return res.status(404).json({ message: 'Schedule not found' });
    return res.json({ message: 'Schedule deleted' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

import mongoose from 'mongoose';
import WorkSchedule from '../models/workSchedule.model.js';
import Employee from '../models/employee.model.js';
import { getNextId, getLocalDateString, docToObject } from '../utils/helpers.js';

export const getSchedules = async (req, res) => {
  try {
    const rawDate = String(req.query?.date || '').trim();
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

    const schedules = await WorkSchedule.find(query).sort({ taskDate: 1, createdAt: -1 }).lean();
    return res.json(schedules.map(s => ({
      ...docToObject(s),
      vehicle: String(s.vehicle || '').trim(),
      location: String(s.location || '').trim(),
      customerContact: String(s.customerContact || '').trim(),
      customerPerson: String(s.customerPerson || '').trim(),
    })));
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
    return res.json(schedules.map(s => {
      const obj = { ...s };
      delete obj._id;
      return obj;
    }));
  } catch (err) {
    console.error('[Backend] Error in getAllSchedules:', err);
    return res.status(500).json({ message: err.message });
  }
};

export const addSchedule = async (req, res) => {
  try {
    const { title, description, taskDate, site, assignedTo, assignedToUsernames } = req.body;
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

    let assignees = [];
    if (assignMode === 'all') {
      const employees = await Employee.find().sort({ id: 1 }).select({ username: 1, name: 1 }).lean();
      assignees = employees.map(e => ({ username: e.username, name: e.name }));
    } else if (assignMode === 'multiple') {
      const usernames = Array.isArray(assignedToUsernames) ? assignedToUsernames : [];
      const employees = await Employee.find({ username: { $in: usernames } }).select({ username: 1, name: 1 }).lean();
      assignees = employees.map(e => ({ username: e.username, name: e.name }));
    } else {
      const emp = await Employee.findOne({ username: assignMode }).select({ username: 1, name: 1 }).lean();
      if (!emp) return res.status(404).json({ message: 'Employee not found' });
      assignees = [{ username: emp.username, name: emp.name }];
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
      assignedToUsername: a.username, assignedToName: a.name,
      assignedByUsername: req.user.username, status: 'pending', statusDate: taskDate || getLocalDateString()
    }));

    const created = await WorkSchedule.insertMany(docs);
    return res.json({ count: created.length, tasks: created.map(s => docToObject(s)) });
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
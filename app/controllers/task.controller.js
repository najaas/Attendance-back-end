import Task from '../models/task.model.js';
import Employee from '../models/employee.model.js';
import { getNextId, getLocalDateString, docToObject } from '../utils/helpers.js';

export const getTasks = async (req, res) => {
  try {
    const requestedDate = String(req.query?.date || '').trim();
    const lite = String(req.query?.lite || '').trim() === '1';
    if (lite) res.set('Cache-Control', 'private, max-age=15');
    const limitNum = Number(req.query?.limit || 0);
    const limit = Number.isFinite(limitNum) ? Math.max(0, Math.min(limitNum, 2000)) : 0;
    const query = req.user.role === 'admin' ? {} : { assignedToUsername: req.user.username };
    if (req.user.role === 'admin') {
      if (requestedDate) query.taskDate = requestedDate;
    } else {
      if (requestedDate) {
        if (requestedDate.toLowerCase() !== 'all') query.taskDate = requestedDate;
      } else {
        query.taskDate = getLocalDateString();
      }
    }
    let q = Task.find(query).sort({ createdAt: -1 });
    if (lite) {
      q = q.select({
        _id: 1,
        id: 1,
        status: 1,
        title: 1,
        assignedToUsername: 1,
        assignedToName: 1,
        taskDate: 1,
      });
    }
    if (limit > 0) q = q.limit(limit);
    const tasks = await q.lean();
    return res.json(tasks.map((t) => docToObject(t)));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const addTask = async (req, res) => {
  try {
    const { title, description, taskDate, assignedTo, assignedToUsernames, adminNote } = req.body;
    const jobNumber = String(req.body?.jobNumber || req.body?.jobNo || '').trim();
    const projectName = String(req.body?.projectName || req.body?.project || '').trim();
    const customerName = String(req.body?.customerName || req.body?.customer || '').trim();
    const assignMode = String(assignedTo || '').trim();

    if (!title?.trim()) return res.status(400).json({ message: 'Task title required' });
    if (!assignMode) return res.status(400).json({ message: 'Task assignee required' });

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

    const firstId = await getNextId(Task, 0);
    const docs = assignees.map((a, idx) => ({
      id: firstId + idx,
      title: title.trim(),
      description: (description || '').trim(),
      jobNumber, projectName, customerName,
      taskDate: taskDate || getLocalDateString(),
      adminNote: String(adminNote || '').trim(),
      assignedToUsername: a.username,
      assignedToName: a.name,
      assignedByUsername: req.user.username,
      status: 'pending'
    }));

    const created = await Task.insertMany(docs);
    return res.json({ count: created.length, tasks: created.map(t => docToObject(t)) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const completeTask = async (req, res) => {
  try {
    if (req.user.role === 'admin') return res.status(403).json({ message: 'Only employees can complete tasks' });
    const taskId = Number(req.params.id);
    const task = await Task.findOne({ id: taskId, assignedToUsername: req.user.username });
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (task.status === 'completed') return res.status(400).json({ message: 'Task already completed' });

    task.status = 'completed';
    task.completionNote = String(req.body?.completionNote || '').trim();
    task.completedAt = new Date();
    await task.save();
    return res.json(docToObject(task));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const updateTask = async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    const task = await Task.findOne({ id: taskId });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const nextTitle = String(req.body?.title || '').trim();
    if (!nextTitle) return res.status(400).json({ message: 'Task title required' });

    task.title = nextTitle;
    task.description = String(req.body?.description || '').trim();
    task.jobNumber = String(req.body?.jobNumber || '').trim();
    task.projectName = String(req.body?.projectName || '').trim();
    task.customerName = String(req.body?.customerName || '').trim();
    task.taskDate = req.body?.taskDate || task.taskDate;
    task.adminNote = String(req.body?.adminNote || '').trim();

    if (req.body?.status) {
      task.status = req.body.status;
      if (req.body.status === 'completed') {
        task.completedAt = task.completedAt || new Date();
        task.completionNote = req.body.completionNote || task.completionNote;
      } else {
        task.completedAt = null;
        task.completionNote = '';
      }
    }

    await task.save();
    return res.json(docToObject(task));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const deleteTask = async (req, res) => {
  try {
    const deleted = await Task.findOneAndDelete({ id: Number(req.params.id) }).lean();
    if (!deleted) return res.status(404).json({ message: 'Task not found' });
    return res.json({ message: 'Task deleted' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
export const updateTaskByEmployee = async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    const task = await Task.findOne({ id: taskId, assignedToUsername: req.user.username });
    if (!task) return res.status(404).json({ message: 'Task not found or unauthorized' });

    if (req.body.panelPhotosSent !== undefined) {
      task.panelPhotosSent = !!req.body.panelPhotosSent;
    }

    await task.save();
    return res.json(docToObject(task));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

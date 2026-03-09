import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 5001);
const SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/attendance_db';

app.use(cors());
app.use(express.json());

function getLocalDateString(dateObj = new Date()) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const userSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    username: { type: String, required: true, unique: true, trim: true, index: true },
    password: { type: String, required: true },
    role: { type: String, required: true, enum: ['admin', 'student'] },
    name: { type: String, trim: true, default: '' },
  },
  { versionKey: false }
);

const studentSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
  },
  { versionKey: false }
);

const employeeSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true, index: true },
    employeeCode: { type: String, required: true, unique: true, trim: true, index: true },
  },
  { versionKey: false }
);

const attendanceSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, unique: true, index: true },
    entries: { type: Map, of: String, default: {} },
  },
  { versionKey: false }
);

const employeeAttendanceSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, index: true },
    employeeUsername: { type: String, required: true, trim: true, index: true },
    employeeName: { type: String, required: true, trim: true },
    officeEntryTime: { type: String, required: true, trim: true },
    officeExitTime: { type: String, default: '', trim: true },
  },
  { strict: false, timestamps: true, versionKey: false }
);

employeeAttendanceSchema.index({ date: 1, employeeUsername: 1 }, { unique: true });

const taskSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    jobNumber: { type: String, default: '', trim: true },
    projectName: { type: String, default: '', trim: true },
    customerName: { type: String, default: '', trim: true },
    taskDate: { type: String, required: true, index: true, default: () => getLocalDateString() },
    location: { type: String, default: '', trim: true },
    site: { type: String, default: 'All Sites', trim: true },
    assignedToUsername: { type: String, required: true, trim: true, index: true },
    assignedToName: { type: String, required: true, trim: true },
    assignedByUsername: { type: String, required: true, trim: true },
    status: { type: String, enum: ['pending', 'completed'], default: 'pending', index: true },
    completionNote: { type: String, default: '', trim: true },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);

const User = mongoose.model('User', userSchema);
const Student = mongoose.model('Student', studentSchema);
const Employee = mongoose.model('Employee', employeeSchema);
const Attendance = mongoose.model('Attendance', attendanceSchema);
const EmployeeAttendance = mongoose.model('EmployeeAttendance', employeeAttendanceSchema);
const Task = mongoose.model('Task', taskSchema);

async function getNextId(model, floor = 0) {
  const maxDoc = await model.findOne().sort({ id: -1 }).select({ id: 1, _id: 0 }).lean();
  return Math.max(Number(maxDoc?.id || 0), floor) + 1;
}

function attendanceDocToRow(doc) {
  const entries = doc.entries instanceof Map ? Object.fromEntries(doc.entries) : (doc.entries || {});
  return { date: String(doc.date), ...entries };
}

function employeeAttendanceDocToObject(doc) {
  const raw = doc?.toObject ? doc.toObject() : doc;
  if (!raw) return null;
  const { _id, createdAt, updatedAt, ...rest } = raw;
  return rest;
}

function taskDocToObject(doc) {
  const raw = doc?.toObject ? doc.toObject() : doc;
  if (!raw) return null;
  const { _id, ...rest } = raw;
  return rest;
}

function parseCSV(csv) {
  const lines = String(csv || '').split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const vals = line.split(',').map((v) => v.trim());
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = vals[i] || '';
    });
    return obj;
  });
}

async function seedDefaultsIfNeeded() {
  const usersCount = await User.countDocuments();
  if (usersCount > 0) return;

  const defaultUsers = [
    { id: 1, username: 'admin', password: 'password', role: 'admin', name: 'Admin' },
    { id: 2, username: 'najas', password: 'password', role: 'student', name: 'najas' },
  ];

  const defaultStudents = defaultUsers
    .filter((u) => u.role === 'student')
    .map((u) => ({ id: u.id, name: u.name }));

  await User.insertMany(defaultUsers);
  await Student.insertMany(defaultStudents);
  console.log(`Seeded defaults: ${defaultUsers.length} users, ${defaultStudents.length} students`);
}

async function backfillEmployeesFromUsersIfNeeded() {
  const employeesCount = await Employee.countDocuments();
  if (employeesCount > 0) return;

  const nonAdminUsers = await User.find({ role: { $ne: 'admin' } })
    .sort({ id: 1 })
    .select({ id: 1, username: 1, name: 1, _id: 0 })
    .lean();

  if (nonAdminUsers.length === 0) return;

  const docs = nonAdminUsers.map((u) => ({
    id: Number(u.id),
    name: String(u.name || u.username || '').trim(),
    username: String(u.username || '').trim(),
    employeeCode: String(u.username || '').trim().toUpperCase(),
  }));

  await Employee.insertMany(docs, { ordered: false });
  console.log(`Backfilled employees: ${docs.length}`);
}


function auth(req, res, next) {
  const token = req.header('Authorization')?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access denied' });
  try {
    req.user = jwt.verify(token, SECRET_KEY);
    next();
  } catch {
    return res.status(403).json({ message: 'Invalid token' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admins only' });
  return next();
}

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username: String(username || '').trim() }).lean();
    if (!user || password !== user.password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, name: user.name || user.username },
      SECRET_KEY
    );
    return res.json({ token, role: user.role });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.post('/api/register', async (req, res) => {
  try {
    const { username, password, fullName } = req.body;
    if (!username || !password || !fullName) {
      return res.status(400).json({ message: 'All fields required' });
    }

    const cleanUsername = String(username).trim();
    const cleanName = String(fullName).trim();
    const exists = await User.findOne({ username: cleanUsername }).lean();
    if (exists) return res.status(400).json({ message: 'Username already exists' });

    const nextId = await getNextId(User, 6);
    const newUser = await User.create({
      id: nextId,
      username: cleanUsername,
      password: String(password),
      role: 'student',
      name: cleanName,
    });
    await Student.create({ id: nextId, name: cleanName });

    const token = jwt.sign(
      { id: newUser.id, username: newUser.username, role: newUser.role, name: newUser.name },
      SECRET_KEY
    );
    return res.json({ token, role: newUser.role });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.get('/api/students', auth, async (req, res) => {
  try {
    const students = await Student.find().sort({ id: 1 }).select({ _id: 0 }).lean();
    return res.json(students);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.post('/api/students', auth, adminOnly, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Name required' });
    const student = await Student.create({
      id: await getNextId(Student, 6),
      name: name.trim(),
    });
    return res.json({ id: student.id, name: student.name });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.delete('/api/students/:id', auth, adminOnly, async (req, res) => {
  try {
    const studentId = Number(req.params.id);
    const deleted = await Student.findOneAndDelete({ id: studentId }).lean();
    if (!deleted) return res.status(404).json({ message: 'Not found' });
    return res.json({ message: 'Deleted' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.get('/api/attendance', auth, async (req, res) => {
  try {
    const data = await Attendance.find().sort({ date: 1 }).lean();
    const rows = data.map(attendanceDocToRow);
    if (req.user.role === 'admin') return res.json(rows);
    return res.json(rows.map((r) => ({ date: r.date, status: r[req.user.name] || '' })));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.get('/api/attendance/date/:date', auth, adminOnly, async (req, res) => {
  try {
    const dateStr = String(req.params.date).trim();
    const record = await Attendance.findOne({ date: dateStr }).lean();
    if (!record) return res.json({});
    const row = attendanceDocToRow(record);
    const { date, ...rest } = row;
    return res.json(rest);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.post('/api/attendance/update', auth, adminOnly, async (req, res) => {
  try {
    const { date, studentName, status } = req.body;
    if (!date || !studentName || !status) {
      return res.status(400).json({ message: 'date, studentName, status required' });
    }
    if (typeof status === 'boolean') {
      return res.status(400).json({ message: 'status must be string' });
    }

    const dateStr = String(date).trim();
    const allowed = ['Present', 'Absent', 'Late', 'Leave'];
    const cleanStatus = allowed.includes(status) ? status : String(status);

    let record = await Attendance.findOne({ date: dateStr });
    if (!record) {
      record = new Attendance({ date: dateStr, entries: {} });
    }
    record.entries.set(String(studentName), cleanStatus);
    await record.save();

    return res.json({ message: 'Updated', row: attendanceDocToRow(record) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.get('/api/employees', auth, adminOnly, async (req, res) => {
  try {
    const employees = await Employee.find().sort({ id: 1 }).select({ _id: 0 }).lean();
    return res.json(employees);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.post('/api/employees', auth, adminOnly, async (req, res) => {
  try {
    const { name, username, password, employeeCode } = req.body;
    if (!name || !username || !password || !employeeCode) return res.status(400).json({ message: 'All fields required' });

    const cleanUsername = String(username).trim();
    const cleanName = String(name).trim();
    const cleanEmployeeCode = String(employeeCode).trim();
    const userExists = await User.findOne({ username: cleanUsername }).lean();
    if (userExists) return res.status(400).json({ message: 'Username exists' });
    const codeExists = await Employee.findOne({ employeeCode: cleanEmployeeCode }).lean();
    if (codeExists) return res.status(400).json({ message: 'Employee ID exists' });

    const nextId = await getNextId(User, 6);
    await User.create({
      id: nextId,
      username: cleanUsername,
      password: String(password),
      role: 'student',
      name: cleanName,
    });
    const emp = await Employee.create({
      id: await getNextId(Employee, 6),
      name: cleanName,
      username: cleanUsername,
      employeeCode: cleanEmployeeCode,
    });
    return res.json({ id: emp.id, name: emp.name, username: emp.username, employeeCode: emp.employeeCode });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.delete('/api/employees/:id', auth, adminOnly, async (req, res) => {
  try {
    const employeeId = Number(req.params.id);
    const emp = await Employee.findOneAndDelete({ id: employeeId }).lean();
    if (!emp) return res.status(404).json({ message: 'Not found' });
    await User.deleteOne({ username: emp.username });
    await Task.deleteMany({ assignedToUsername: emp.username });
    return res.json({ message: 'Deleted' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.get('/api/tasks', auth, async (req, res) => {
  try {
    const requestedDate = String(req.query?.date || '').trim();
    const query = req.user.role === 'admin' ? {} : { assignedToUsername: req.user.username };
    if (req.user.role === 'admin') {
      if (requestedDate) query.taskDate = requestedDate;
    } else {
      query.taskDate = requestedDate || getLocalDateString();
    }
    const tasks = await Task.find(query).sort({ createdAt: -1 }).lean();
    return res.json(tasks.map(taskDocToObject));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.post('/api/tasks', auth, adminOnly, async (req, res) => {
  try {
    const { title, description, taskDate, site, assignedTo, assignedToUsernames } = req.body;
    const location = String(req.body?.location || req.body?.taskLocation || '').trim();
    const jobNumber = String(req.body?.jobNumber || req.body?.jobNo || '').trim();
    const projectName = String(req.body?.projectName || req.body?.project || '').trim();
    const customerName = String(req.body?.customerName || req.body?.customer || '').trim();
    const assignMode = String(assignedTo || '').trim();
    if (!title?.trim()) return res.status(400).json({ message: 'Task title required' });
    if (!assignMode) return res.status(400).json({ message: 'Task assignee required' });
    const cleanTaskDate = String(taskDate || '').trim() || getLocalDateString();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanTaskDate)) {
      return res.status(400).json({ message: 'Valid task date required (YYYY-MM-DD)' });
    }

    let assignees = [];
    if (assignMode === 'all') {
      const employees = await Employee.find().sort({ id: 1 }).select({ username: 1, name: 1, _id: 0 }).lean();
      assignees = employees.map((emp) => ({
        username: String(emp.username || '').trim(),
        name: String(emp.name || emp.username || '').trim(),
      }));
    } else if (assignMode === 'multiple') {
      const usernames = Array.isArray(assignedToUsernames)
        ? [...new Set(assignedToUsernames.map((u) => String(u || '').trim()).filter(Boolean))]
        : [];
      if (usernames.length === 0) {
        return res.status(400).json({ message: 'Select at least one employee' });
      }

      const employees = await Employee.find({ username: { $in: usernames } })
        .select({ username: 1, name: 1, _id: 0 })
        .lean();
      const foundUsernames = new Set(employees.map((e) => String(e.username || '').trim()));
      const missingUsernames = usernames.filter((u) => !foundUsernames.has(u));
      if (missingUsernames.length > 0) {
        return res.status(404).json({ message: `Employee not found: ${missingUsernames.join(', ')}` });
      }

      assignees = employees.map((emp) => ({
        username: String(emp.username || '').trim(),
        name: String(emp.name || emp.username || '').trim(),
      }));
    } else {
      const employee = await Employee.findOne({ username: assignMode })
        .select({ username: 1, name: 1, _id: 0 })
        .lean();
      if (!employee) return res.status(404).json({ message: 'Employee not found' });
      assignees = [
        {
          username: String(employee.username || '').trim(),
          name: String(employee.name || employee.username || '').trim(),
        },
      ];
    }

    if (assignees.length === 0) return res.status(400).json({ message: 'No employees to assign' });

    const firstId = await getNextId(Task, 0);
    const docs = assignees.map((assignee, idx) => ({
      id: firstId + idx,
      title: String(title).trim(),
      description: String(description || '').trim(),
      jobNumber,
      projectName,
      customerName,
      taskDate: cleanTaskDate,
      location,
      site: String(site || 'All Sites').trim() || 'All Sites',
      assignedToUsername: assignee.username,
      assignedToName: assignee.name,
      assignedByUsername: req.user.username,
      status: 'pending',
      completionNote: '',
      completedAt: null,
    }));

    const created = await Task.insertMany(docs);
    return res.json({ message: 'Task assigned', count: created.length, tasks: created.map(taskDocToObject) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.put('/api/tasks/:id/complete', auth, async (req, res) => {
  try {
    if (req.user.role === 'admin') return res.status(403).json({ message: 'Only employees can complete tasks' });

    const taskId = Number(req.params.id);
    if (!Number.isFinite(taskId)) return res.status(400).json({ message: 'Invalid task id' });

    const task = await Task.findOne({ id: taskId, assignedToUsername: req.user.username });
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (task.status === 'completed') return res.status(400).json({ message: 'Task already completed' });

    task.status = 'completed';
    task.completionNote = String(req.body?.completionNote || '').trim();
    task.completedAt = new Date();
    await task.save();

    return res.json(taskDocToObject(task));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.put('/api/tasks/:id', auth, adminOnly, async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    if (!Number.isFinite(taskId)) return res.status(400).json({ message: 'Invalid task id' });

    const task = await Task.findOne({ id: taskId });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const nextTitle = String(req.body?.title || '').trim();
    if (!nextTitle) return res.status(400).json({ message: 'Task title required' });
    const nextTaskDate = String(req.body?.taskDate || task.taskDate || '').trim() || getLocalDateString();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextTaskDate)) {
      return res.status(400).json({ message: 'Valid task date required (YYYY-MM-DD)' });
    }

    task.title = nextTitle;
    task.description = String(req.body?.description || '').trim();
    task.jobNumber = String(req.body?.jobNumber || req.body?.jobNo || '').trim();
    task.projectName = String(req.body?.projectName || req.body?.project || '').trim();
    task.customerName = String(req.body?.customerName || req.body?.customer || '').trim();
    task.taskDate = nextTaskDate;
    task.location = String(req.body?.location || req.body?.taskLocation || '').trim();
    task.site = String(req.body?.site || 'All Sites').trim() || 'All Sites';

    const assignedToUsername = String(req.body?.assignedToUsername || '').trim();
    if (assignedToUsername && assignedToUsername !== task.assignedToUsername) {
      const employee = await Employee.findOne({ username: assignedToUsername })
        .select({ username: 1, name: 1, _id: 0 })
        .lean();
      if (!employee) return res.status(404).json({ message: 'Employee not found' });
      task.assignedToUsername = String(employee.username || '').trim();
      task.assignedToName = String(employee.name || employee.username || '').trim();
    }

    const nextStatus = String(req.body?.status || task.status).trim().toLowerCase();
    if (!['pending', 'completed'].includes(nextStatus)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    task.status = nextStatus;

    if (nextStatus === 'completed') {
      task.completionNote = String(req.body?.completionNote || task.completionNote || '').trim();
      task.completedAt = task.completedAt || new Date();
    } else {
      task.completionNote = '';
      task.completedAt = null;
    }

    await task.save();
    return res.json(taskDocToObject(task));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.delete('/api/tasks/:id', auth, adminOnly, async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    if (!Number.isFinite(taskId)) return res.status(400).json({ message: 'Invalid task id' });

    const deleted = await Task.findOneAndDelete({ id: taskId }).lean();
    if (!deleted) return res.status(404).json({ message: 'Task not found' });

    return res.json({ message: 'Task deleted' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.post('/api/employee-attendance', auth, async (req, res) => {
  try {
    const empUsername = req.user.username;
    const empName = req.user.name || req.user.username;
    const { date, officeEntryTime, officeExitTime, jobNumber, ...rest } = req.body;
    const dateStr = String(date || '').trim();
    if (!dateStr) return res.status(400).json({ message: 'date required' });
    if (!officeEntryTime) return res.status(400).json({ message: 'Office entry time required' });

    const exists = await EmployeeAttendance.findOne({ date: dateStr, employeeUsername: empUsername }).lean();
    if (exists) return res.status(400).json({ message: 'Already recorded for this date' });

    const recordPayload = {
      date: dateStr,
      employeeUsername: empUsername,
      employeeName: empName,
      officeEntryTime,
      officeExitTime: officeExitTime || '',
      jobNumber: String(jobNumber || '').trim(),
    };
    Object.keys(rest).forEach((k) => {
      if (k.startsWith('site')) recordPayload[k] = rest[k];
    });

    const record = await EmployeeAttendance.create(recordPayload);
    return res.json(employeeAttendanceDocToObject(record));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.put('/api/employee-attendance', auth, async (req, res) => {
  try {
    const empUsername = req.user.username;
    const empName = req.user.name || req.user.username;
    const { date, officeEntryTime, officeExitTime, jobNumber, ...rest } = req.body;
    const dateStr = String(date || '').trim();
    if (!dateStr) return res.status(400).json({ message: 'date required' });

    const current = await EmployeeAttendance.findOne({ date: dateStr, employeeUsername: empUsername });
    if (!current) return res.status(404).json({ message: 'Record not found' });

    current.employeeName = empName;
    current.officeEntryTime = officeEntryTime || '';
    current.officeExitTime = officeExitTime || '';
    current.jobNumber = String(jobNumber || '').trim();

    Object.keys(current.toObject()).forEach((k) => {
      if (k.startsWith('site')) current.set(k, undefined);
    });
    Object.keys(rest).forEach((k) => {
      if (k.startsWith('site')) current.set(k, rest[k]);
    });

    await current.save();
    return res.json(employeeAttendanceDocToObject(current));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.get('/api/employee-attendance/:date', auth, async (req, res) => {
  try {
    const empUsername = req.user.username;
    const dateStr = String(req.params.date || '').trim();
    const record = await EmployeeAttendance.findOne({ date: dateStr, employeeUsername: empUsername }).lean();
    return res.json(record ? employeeAttendanceDocToObject(record) : null);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.get('/api/employee-attendance-history', auth, async (req, res) => {
  try {
    const empUsername = req.user.username;
    const records = await EmployeeAttendance.find({ employeeUsername: empUsername })
      .sort({ date: -1, createdAt: -1 })
      .lean();
    return res.json(records.map(employeeAttendanceDocToObject));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.get('/api/admin/employee-attendance', auth, adminOnly, async (req, res) => {
  try {
    const records = await EmployeeAttendance.find().sort({ date: -1, createdAt: -1 }).lean();
    return res.json(records.map(employeeAttendanceDocToObject));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.post('/api/import-data', auth, adminOnly, async (req, res) => {
  try {
    const { type, csvData } = req.body;
    const rows = parseCSV(csvData);
    let count = 0;

    if (type === 'students') {
      for (const r of rows) {
        const name = r.Name?.trim();
        if (!name) continue;
        const exists = await Student.findOne({ name }).lean();
        if (exists) continue;
        await Student.create({ id: await getNextId(Student, 6), name });
        count += 1;
      }
    } else if (type === 'attendance') {
      for (const r of rows) {
        if (!r.Date || !r['Student Name']) continue;
        const dateStr = String(r.Date).trim();
        const studentName = String(r['Student Name']).trim();
        if (!dateStr || !studentName) continue;

        let row = await Attendance.findOne({ date: dateStr });
        if (!row) row = new Attendance({ date: dateStr, entries: {} });
        row.entries.set(
          studentName,
          String(r.Present || '').toLowerCase() === 'yes' ? 'Present' : 'Absent'
        );
        await row.save();
        count += 1;
      }
    }

    return res.json({ message: 'Imported', count });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => res.json({}));

async function start() {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 15000,
    });
    console.log('MongoDB connected');
    await seedDefaultsIfNeeded();
    await backfillEmployeesFromUsersIfNeeded();
    app.listen(PORT, () => {
      console.log(`Server: http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();

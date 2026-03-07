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

const User = mongoose.model('User', userSchema);
const Student = mongoose.model('Student', studentSchema);
const Employee = mongoose.model('Employee', employeeSchema);
const Attendance = mongoose.model('Attendance', attendanceSchema);
const EmployeeAttendance = mongoose.model('EmployeeAttendance', employeeAttendanceSchema);

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
    { id: 2, username: 'alice', password: 'password', role: 'student', name: 'Alice Johnson' },
    { id: 3, username: 'bob', password: 'password', role: 'student', name: 'Bob Smith' },
    { id: 4, username: 'charlie', password: 'password', role: 'student', name: 'Charlie Davis' },
    { id: 5, username: 'diana', password: 'password', role: 'student', name: 'Diana Wilson' },
    { id: 6, username: 'eve', password: 'password', role: 'student', name: 'Eve Martinez' },
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
    return res.json({ message: 'Deleted' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.post('/api/employee-attendance', auth, async (req, res) => {
  try {
    const empUsername = req.user.username;
    const empName = req.user.name || req.user.username;
    const { date, officeEntryTime, officeExitTime, ...rest } = req.body;
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
    const { date, officeEntryTime, officeExitTime, ...rest } = req.body;
    const dateStr = String(date || '').trim();
    if (!dateStr) return res.status(400).json({ message: 'date required' });

    const current = await EmployeeAttendance.findOne({ date: dateStr, employeeUsername: empUsername });
    if (!current) return res.status(404).json({ message: 'Record not found' });

    current.employeeName = empName;
    current.officeEntryTime = officeEntryTime || '';
    current.officeExitTime = officeExitTime || '';

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

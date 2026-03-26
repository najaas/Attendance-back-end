import mongoose from 'mongoose';
import User from '../models/user.model.js';
import Student from '../models/student.model.js';
import Employee from '../models/employee.model.js';

export const connectDB = async () => {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/attendance_db';

  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000, // 10s timeout
    });
    console.log('✅ MongoDB Connected...');
    await seedDefaultsIfNeeded();
    await backfillEmployeesFromUsersIfNeeded();
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err.message);
    process.exit(1);
  }
};

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
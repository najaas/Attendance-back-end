import mongoose from 'mongoose';
import User from '../models/user.model.js';
import Employee from '../models/employee.model.js';

export const connectDB = async () => {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('FATAL: MONGODB_URI is not set in environment. Server cannot start.');
    process.exit(1);
  }
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB Connected.');
    await ensureAdminExists();
    await backfillEmployeesFromUsersIfNeeded();
  } catch (err) {
    console.error('MongoDB Connection Error:', err.message);
    process.exit(1);
  }
};

// Only create a default admin if no users exist AT ALL.
// Uses env variables — never hardcoded weak passwords.
async function ensureAdminExists() {
  const usersCount = await User.countDocuments();
  if (usersCount > 0) return;

  const adminUsername = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD;

  if (!adminPassword) {
    console.warn('⚠️  No users exist and DEFAULT_ADMIN_PASSWORD is not set in .env — skipping auto-seed. Create the admin user manually via database.');
    return;
  }

  await User.create({
    id: 1,
    username: adminUsername,
    password: adminPassword,
    role: 'admin',
    name: 'Admin',
  });
  console.log(`Admin user '${adminUsername}' created. Change the password immediately.`);
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
  console.log(`Backfilled ${docs.length} employees.`);
}

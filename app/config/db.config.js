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

// Sync admin from environment variables
async function ensureAdminExists() {
  const adminUsername = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'password';

  const admin = await User.findOne({ username: adminUsername });
  if (admin) {
    // Force update password to match ENV on every startup (as requested)
    await User.updateOne({ username: adminUsername }, { $set: { password: adminPassword } });
    console.log(`✅ Existing admin password synchronized with environment variable.`);
  } else {
    const maxUser = await User.findOne().sort({ id: -1 }).select({ id: 1 }).lean();
    const nextId = Math.max(Number(maxUser?.id || 0), 0) + 1;
    await User.create({
      id: nextId,
      username: adminUsername,
      password: adminPassword,
      role: 'admin',
      name: 'Admin',
    });
    console.log(`✅ New admin user '${adminUsername}' created from environment variable.`);
  }
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

import mongoose from 'mongoose';
import User from '../models/user.model.js';
import Employee from '../models/employee.model.js';
import EmployeeAttendance from '../models/employeeAttendance.model.js';

let legacyIndexHandled = false;

export function resetLegacyIndexCache() {
  legacyIndexHandled = false;
}

/** Fill missing Employee ID on rows so legacy unique index can be dropped. */
export async function backfillAttendanceEmployeeIds() {
  const rows = await EmployeeAttendance.find({
    $or: [
      { employeeUsername: null },
      { employeeUsername: '' },
      { employeeUsername: { $exists: false } },
      { employeeCode: null },
      { employeeCode: '' },
      { employeeCode: { $exists: false } },
    ],
  })
    .select({ _id: 1, employeeId: 1, employeeCode: 1, employeeUsername: 1 })
    .lean();

  for (const row of rows) {
    let code = String(row.employeeCode || row.employeeUsername || '').trim();
    if (!code && row.employeeId != null) {
      const user = await User.findOne({ id: row.employeeId }).select({ username: 1 }).lean();
      if (user?.username) {
        const emp = await Employee.findOne({ username: user.username })
          .select({ employeeCode: 1 })
          .lean();
        code = String(emp?.employeeCode || '').trim();
      }
    }
    if (!code && row.employeeId != null) {
      code = `uid_${row.employeeId}`;
    }
    if (!code) continue;

    await EmployeeAttendance.collection.updateOne(
      { _id: row._id },
      { $set: { employeeCode: code, employeeUsername: code } }
    );
  }
}

/** Remove old date+employeeUsername index that breaks when username is null. */
export async function ensureLegacyAttendanceIndexRemoved() {
  if (legacyIndexHandled) return;

  await backfillAttendanceEmployeeIds();

  const coll = mongoose.connection.collection('employeeattendances');
  const indexes = await coll.indexes();
  const stale = indexes.find((i) => i.name === 'date_1_employeeUsername_1');
  if (stale) {
    try {
      await coll.dropIndex('date_1_employeeUsername_1');
      console.log('[attendance] Dropped legacy index date_1_employeeUsername_1');
    } catch (err) {
      console.warn('[attendance] dropIndex failed, re-backfilling:', err.message);
      await backfillAttendanceEmployeeIds();
      await coll.dropIndex('date_1_employeeUsername_1');
      console.log('[attendance] Dropped legacy index after backfill');
    }
  }

  legacyIndexHandled = true;
}

/** Patch this user's row for the day before save (avoids duplicate null username). */
export async function repairAttendanceRowForIdentity(date, identity) {
  if (!date || !identity?.employeeCode) return;

  await EmployeeAttendance.updateMany(
    {
      date,
      employeeId: identity.employeeId,
      $or: [
        { employeeUsername: null },
        { employeeUsername: '' },
        { employeeUsername: { $exists: false } },
      ],
    },
    {
      $set: {
        employeeCode: identity.employeeCode,
        employeeUsername: identity.employeeCode,
      },
    }
  );
}

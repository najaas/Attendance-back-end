import mongoose from 'mongoose';
import EmployeeAttendance from './app/models/employeeAttendance.model.js';

mongoose.connect('mongodb://127.0.0.1:27017/attendance_db').then(async () => {
  const doc = await EmployeeAttendance.findOne({ employeeUsername: 'najas', date: '2026-04-01' }).lean();
  console.log('--- NAJAS 2026-04-01 DOCUMENT ---');
  console.log(JSON.stringify(doc, null, 2));
  process.exit();
}).catch(err => {
  console.error(err);
  process.exit();
});

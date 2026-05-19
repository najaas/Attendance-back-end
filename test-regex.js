import mongoose from 'mongoose';
import Employee from './app/models/employee.model.js';

mongoose.connect('mongodb://127.0.0.1:27017/attendance_db').then(async () => {
  const uniqueUsers = ['ajmal', 'najas'];
  const emps = await Employee.find({ username: { $in: uniqueUsers.map(u => new RegExp('^'+u+'$', 'i')) } }).lean();
  console.log(emps.map(e => e.username));
  process.exit(0);
});

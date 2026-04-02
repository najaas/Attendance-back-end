import mongoose from 'mongoose';
import EmployeeAttendance from './app/models/employeeAttendance.model.js';

async function check() {
    await mongoose.connect('mongodb://127.0.0.1:27017/attendance_db');
    const atts = await EmployeeAttendance.find({ date: '2026-04-01' }).lean();
    atts.forEach(a => {
        console.log(`D: ${a.date} U: [${a.employeeUsername}] N: [${a.employeeName}]`);
    });
    process.exit();
}

check();

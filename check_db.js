import mongoose from 'mongoose';
import dotenv from 'dotenv';
import EmployeeAttendance from './app/models/employeeAttendance.model.js';

dotenv.config();

async function check() {
    await mongoose.connect('mongodb://127.0.0.1:27017/attendance_db' || process.env.MONGODB_URI);
    const count = await EmployeeAttendance.countDocuments();
    const lastRec = await EmployeeAttendance.findOne().sort({ date: -1 });
    console.log("Total records:", count);
    if (lastRec) {
        console.log("Last record date:", lastRec.date);
    }
    process.exit();
}

check();

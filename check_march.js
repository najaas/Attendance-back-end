import mongoose from 'mongoose';
import dotenv from 'dotenv';
import EmployeeAttendance from './app/models/employeeAttendance.model.js';

dotenv.config();

async function check() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/attendance_db');
    const marchCount = await EmployeeAttendance.countDocuments({ date: { $regex: '^2026-03' } });
    const sample = await EmployeeAttendance.findOne({ date: { $regex: '^2026-03' } }).lean();
    console.log("March records:", marchCount);
    if (sample) {
        console.log("Sample March record:", JSON.stringify(sample, null, 2));
    }
    process.exit();
}

check();

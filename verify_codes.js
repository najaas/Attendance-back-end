import mongoose from 'mongoose';
import Employee from './app/models/employee.model.js';
import EmployeeAttendance from './app/models/employeeAttendance.model.js';

async function verify() {
    await mongoose.connect('mongodb://127.0.0.1:27017/attendance_db');
    
    console.log("--- Employee Map ---");
    const employees = await Employee.find({}, 'username employeeCode').lean();
    employees.forEach(e => console.log(`U: [${e.username}] Code: [${e.employeeCode}]`));

    console.log("\n--- Attendance Data ---");
    const att = await EmployeeAttendance.findOne().lean();
    if (att) {
        console.log(`Sample Att -> U: [${att.employeeUsername}] Name: [${att.employeeName}]`);
    } else {
        console.log("No attendance records found.");
    }

    process.exit();
}

verify();

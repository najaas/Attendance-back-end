import express from 'express';
import * as employeeController from '../controllers/employee.controller.js';
import * as attendanceController from '../controllers/attendance.controller.js';
import { auth, adminOnly } from '../middleware/auth.js';

const router = express.Router();

// employee-attendance (standalone)
router.get('/admin/employee-attendance', auth, adminOnly, attendanceController.getAllEmployeeAttendance);
router.get('/employee-attendance-history', auth, attendanceController.getEmployeeAttendanceHistory);
router.get('/employee-attendance/:date', auth, attendanceController.getEmployeeAttendanceByDate);
router.post('/employee-attendance', auth, attendanceController.logEmployeeAttendance);
router.put('/employee-attendance', auth, attendanceController.updateEmployeeAttendance);
router.patch('/admin/employee-attendance/break', auth, adminOnly, attendanceController.updateBreakMinutes);



// import-data (standalone)
router.post('/import-data', auth, adminOnly, employeeController.importData);

export default router;

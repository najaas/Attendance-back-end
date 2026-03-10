import express from 'express';
import * as attendanceController from '../controllers/attendance.controller.js';
import { auth, adminOnly } from '../middleware/auth.js';

const router = express.Router();

// Student Attendance (prefixed with /api/attendance in server.js)
router.get('/', auth, attendanceController.getAttendance);
router.get('/date/:date', auth, adminOnly, attendanceController.getAttendanceByDate);
router.post('/update', auth, adminOnly, attendanceController.updateAttendance);

export default router;

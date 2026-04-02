import express from 'express';
import * as employeeController from '../controllers/employee.controller.js';
import * as attendanceController from '../controllers/attendance.controller.js';
import { auth, adminOnly } from '../middleware/auth.js';

const router = express.Router();

// employee-attendance (standalone)
router.patch('/admin/employee-attendance/break', auth, adminOnly, attendanceController.updateBreakMinutes);

// mobile push notifications
router.post('/mobile/push-token', auth, employeeController.registerPushToken);
router.delete('/mobile/push-token', auth, employeeController.removePushToken);



// import-data (standalone)
router.post('/import-data', auth, adminOnly, employeeController.importData);

export default router;

import express from 'express';
import * as employeeController from '../controllers/employee.controller.js';
import * as attendanceController from '../controllers/attendance.controller.js';
import Employee from '../models/employee.model.js';
import { auth, adminOnly } from '../middleware/auth.js';

const router = express.Router();

// employee-attendance (standalone)
router.patch('/admin/employee-attendance/break', auth, adminOnly, attendanceController.updateBreakMinutes);

// mobile push notifications
router.post('/mobile/push-token', auth, employeeController.registerPushToken);
router.delete('/mobile/push-token', auth, employeeController.removePushToken);

// DEBUG: check which employees have push tokens saved (admin only)
router.get('/debug/push-tokens', auth, adminOnly, async (req, res) => {
  try {
    const emps = await Employee.find({}, 'username name pushTokens').lean();
    const result = emps.map(e => ({
      username: e.username,
      name: e.name,
      tokenCount: (e.pushTokens || []).length,
      tokens: (e.pushTokens || []).map(t => ({
        platform: t.platform,
        updatedAt: t.updatedAt,
        tokenPreview: String(t.token || '').slice(0, 20) + '...'
      }))
    }));
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// import-data (standalone)
router.post('/import-data', auth, adminOnly, employeeController.importData);

export default router;

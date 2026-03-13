import express from 'express';
import * as scheduleController from '../controllers/schedule.controller.js';
import { auth, adminOnly } from '../middleware/auth.js';

const router = express.Router();

// Schedule routes (prefixed with /api in server.js)
router.get('/schedule', auth, scheduleController.getSchedules);
router.get('/schedule-history', auth, scheduleController.getAllSchedules);
router.post('/work-schedules', auth, adminOnly, scheduleController.addSchedule);
router.put('/work-schedules/:id', auth, adminOnly, scheduleController.updateSchedule);
router.delete('/work-schedules/:id', auth, adminOnly, scheduleController.deleteSchedule);

export default router;

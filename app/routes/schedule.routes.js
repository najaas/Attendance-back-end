import express from 'express';
import * as scheduleController from '../controllers/schedule.controller.js';
import { auth, adminOnly } from '../middleware/auth.js';

const router = express.Router();

// Schedule routes (prefixed with /api in server.js)
router.get('/schedule', auth, scheduleController.getSchedules);
router.post('/work-schedules', auth, adminOnly, scheduleController.addSchedule);

export default router;

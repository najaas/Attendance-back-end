import express from 'express';
import { chatWithRobot } from '../controllers/robotController.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

router.post('/chat', auth, chatWithRobot);

export default router;

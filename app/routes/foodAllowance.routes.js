import express from 'express';
import { getFoodReport, updateFoodEntry, deleteFoodEntry } from '../controllers/foodAllowance.controller.js';
import { auth, adminOnly } from '../middleware/auth.js';

const router = express.Router();

router.get('/report', auth, adminOnly, getFoodReport);
router.post('/entry', auth, adminOnly, updateFoodEntry);
router.delete('/entry/:id', auth, adminOnly, deleteFoodEntry);

export default router;

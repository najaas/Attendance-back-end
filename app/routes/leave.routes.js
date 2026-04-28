import express from 'express';
import { getLeaves, updateLeaveStatus, deleteLeave } from '../controllers/leave.controller.js';

const router = express.Router();

router.get('/', getLeaves);
router.patch('/:id', updateLeaveStatus);
router.delete('/:id', deleteLeave);

export default router;

import express from 'express';
import * as taskController from '../controllers/task.controller.js';
import { auth, adminOnly } from '../middleware/auth.js';

const router = express.Router();

// Task routes (prefixed with /api/tasks in server.js)
router.get('/', auth, taskController.getTasks);
router.post('/', auth, taskController.addTask);
router.put('/:id', auth, adminOnly, taskController.updateTask);
router.delete('/:id', auth, adminOnly, taskController.deleteTask);
router.put('/:id/complete', auth, taskController.completeTask);
router.put('/:id/update', auth, taskController.updateTaskByEmployee);

export default router;

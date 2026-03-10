import express from 'express';
import * as userController from '../controllers/user.controller.js';
import { auth, adminOnly } from '../middleware/auth.js';

const router = express.Router();

router.get('/', auth, userController.getStudents);
router.post('/', auth, adminOnly, userController.addStudent);
router.delete('/:id', auth, adminOnly, userController.deleteStudent);

export default router;

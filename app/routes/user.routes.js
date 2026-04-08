import express from 'express';
import * as userController from '../controllers/user.controller.js';
import { auth, adminOnly } from '../middleware/auth.js';

const router = express.Router();

// Public login — rate limited inside controller
router.post('/login', userController.login);

// Register is ADMIN-ONLY — cannot be called without a valid admin token
router.post('/register', auth, adminOnly, userController.register);

export default router;

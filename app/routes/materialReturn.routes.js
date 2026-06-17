import express from 'express';
import { createReturn, getReturns, updateReturn, deleteReturn } from '../controllers/materialReturn.controller.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// Define material returns routes, protecting all with the authentication middleware
router.post('/', auth, createReturn);
router.get('/', auth, getReturns);
router.put('/:id', auth, updateReturn);
router.delete('/:id', auth, deleteReturn);

export default router;

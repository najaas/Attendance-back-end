import express from 'express';
import { createReturn, getReturns, updateReturn, deleteReturn } from '../controllers/materialReturn.controller.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

router.post('/', auth, createReturn);
router.get('/', auth, getReturns);
router.put('/:id', auth, updateReturn);
router.delete('/:id', auth, deleteReturn);

export default router;
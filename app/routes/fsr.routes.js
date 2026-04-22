import express from 'express';
import { saveFSR, getFSRs, deleteFSR, updateFSR } from '../controllers/fsr.controller.js';
import { auth, adminOnly } from '../middleware/auth.js';

const router = express.Router();

router.post('/', auth, saveFSR);
router.get('/', auth, getFSRs);
router.put('/:id', auth, updateFSR);
router.delete('/:id', [auth, adminOnly], deleteFSR);

export default router;

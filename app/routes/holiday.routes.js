import express from 'express';
import { getHolidays, createHoliday, deleteHoliday } from '../controllers/holiday.controller.js';

const router = express.Router();

router.get('/', getHolidays);
router.post('/', createHoliday);
router.delete('/:id', deleteHoliday);

export default router;

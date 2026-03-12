import express from 'express';
import * as employeeController from '../controllers/employee.controller.js';
import { auth, adminOnly } from '../middleware/auth.js';

const router = express.Router();

router.get('/', auth, adminOnly, employeeController.getEmployees);
router.post('/', auth, adminOnly, employeeController.addEmployee);
router.put('/:id', auth, adminOnly, employeeController.updateEmployee);
router.delete('/:id', auth, adminOnly, employeeController.deleteEmployee);

export default router;

import express from 'express';
import {
  uploadTemplate, getTemplates, getTemplateById, deleteTemplate,
  submitReport, getSubmissions, downloadSubmission, getMySubmissions, deleteSubmission
} from '../controllers/satReport.controller.js';
import { auth, adminOnly } from '../middleware/auth.js';

const router = express.Router();

router.post('/templates', auth, adminOnly, uploadTemplate);
router.get('/templates', auth, getTemplates);
router.get('/templates/:id', auth, getTemplateById);
router.delete('/templates/:id', auth, adminOnly, deleteTemplate);

router.post('/submissions', auth, submitReport);
router.get('/my-submissions', auth, getMySubmissions);
router.get('/submissions', auth, adminOnly, getSubmissions);
router.get('/submissions/:id/download', auth, adminOnly, downloadSubmission);
router.delete('/submissions/:id', auth, adminOnly, deleteSubmission);

export default router;

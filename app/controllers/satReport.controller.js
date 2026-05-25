import SatReportTemplate from '../models/satReportTemplate.model.js';
import SatReportSubmission from '../models/satReportSubmission.model.js';

// Create Template (Admin Only)
export const uploadTemplate = async (req, res) => {
  try {
    const { title, description, templateType, fields, assignedEmployees, fileName, fileData, fileType } = req.body;
    if (!title) return res.status(400).json({ message: 'Title is required' });

    if (templateType === 'file') {
      if (!fileName || !fileData || !fileType) {
        return res.status(400).json({ message: 'fileName, fileData, and fileType are required for file templates' });
      }
    } else {
      if (!Array.isArray(fields) || fields.length === 0) {
        return res.status(400).json({ message: 'At least one form field is required for form templates' });
      }
    }

    const template = await SatReportTemplate.create({
      title,
      description,
      templateType: templateType || 'form',
      fields: templateType === 'file' ? [] : fields,
      fileName: templateType === 'file' ? fileName : '',
      fileData: templateType === 'file' ? fileData : '',
      fileType: templateType === 'file' ? fileType : '',
      uploadedBy: req.user.username,
      assignedEmployees: Array.isArray(assignedEmployees) ? assignedEmployees : []
    });

    const responseObj = template.toObject();
    if (templateType === 'file') delete responseObj.fileData; // don't return heavy base64
    return res.status(201).json({ message: 'SAT template created successfully', template: responseObj });
  } catch (error) {
    console.error('uploadTemplate error:', error);
    return res.status(500).json({ message: error.message });
  }
};

// Get Templates (filter for non-admin by assignment)
export const getTemplates = async (req, res) => {
  try {
    let query = {};
    if (req.user.role !== 'admin') {
      query = {
        $or: [
          { assignedEmployees: { $exists: false } },
          { assignedEmployees: { $size: 0 } },
          { assignedEmployees: req.user.username }
        ]
      };
    }
    const templates = await SatReportTemplate.find(query, '-fileData').sort({ createdAt: -1 }).lean();
    return res.json(templates);
  } catch (error) {
    console.error('getTemplates error:', error);
    return res.status(500).json({ message: error.message });
  }
};

// Get single template (with file data for download)
export const getTemplateById = async (req, res) => {
  try {
    const template = await SatReportTemplate.findById(req.params.id).lean();
    if (!template) return res.status(404).json({ message: 'Template not found or has expired' });
    return res.json(template);
  } catch (error) {
    console.error('getTemplateById error:', error);
    return res.status(500).json({ message: error.message });
  }
};

// Delete Template
export const deleteTemplate = async (req, res) => {
  try {
    const deleted = await SatReportTemplate.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Template not found' });
    await SatReportSubmission.deleteMany({ templateId: req.params.id });
    return res.json({ message: 'Template and submissions deleted' });
  } catch (error) {
    console.error('deleteTemplate error:', error);
    return res.status(500).json({ message: error.message });
  }
};

// Submit filled report (Employee)
export const submitReport = async (req, res) => {
  try {
    const { templateId, templateTitle, templateType, responses, fileName, fileData, fileType } = req.body;
    if (!templateId || !templateTitle) {
      return res.status(400).json({ message: 'templateId and templateTitle are required' });
    }

    const submission = await SatReportSubmission.create({
      templateId,
      templateTitle,
      templateType: templateType || 'form',
      employeeUsername: req.user.username,
      employeeName: req.user.name || req.user.username,
      responses: responses || [],
      fileName: fileName || '',
      fileData: fileData || '',
      fileType: fileType || '',
    });

    const responseObj = submission.toObject();
    if (templateType === 'file') delete responseObj.fileData;
    return res.status(201).json({ message: 'SAT Report submitted successfully', submission: responseObj });
  } catch (error) {
    console.error('submitReport error:', error);
    return res.status(500).json({ message: error.message });
  }
};

// Get all submissions (Admin)
export const getSubmissions = async (req, res) => {
  try {
    const query = req.query.templateId ? { templateId: req.query.templateId } : {};
    const submissions = await SatReportSubmission.find(query, '-fileData').sort({ createdAt: -1 }).lean();
    return res.json(submissions);
  } catch (error) {
    console.error('getSubmissions error:', error);
    return res.status(500).json({ message: error.message });
  }
};

// Download a submitted file (Admin)
export const downloadSubmission = async (req, res) => {
  try {
    const sub = await SatReportSubmission.findById(req.params.id).lean();
    if (!sub) return res.status(404).json({ message: 'Submission not found' });
    return res.json({ fileData: sub.fileData, fileName: sub.fileName, fileType: sub.fileType });
  } catch (error) {
    console.error('downloadSubmission error:', error);
    return res.status(500).json({ message: error.message });
  }
};

// Get My Submissions (Employee)
export const getMySubmissions = async (req, res) => {
  try {
    const submissions = await SatReportSubmission.find({ employeeUsername: req.user.username }, '-fileData')
      .sort({ createdAt: -1 }).lean();
    return res.json(submissions);
  } catch (error) {
    console.error('getMySubmissions error:', error);
    return res.status(500).json({ message: error.message });
  }
};

// Delete Submission (Admin)
export const deleteSubmission = async (req, res) => {
  try {
    const deleted = await SatReportSubmission.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Submission not found' });
    return res.json({ message: 'Submission deleted' });
  } catch (error) {
    console.error('deleteSubmission error:', error);
    return res.status(500).json({ message: error.message });
  }
};

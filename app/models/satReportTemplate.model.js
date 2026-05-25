import mongoose from 'mongoose';

const fieldSchema = new mongoose.Schema({
  label: { type: String, required: true },
  type: { type: String, enum: ['text', 'textarea', 'number', 'date'], default: 'text' },
  required: { type: Boolean, default: false }
}, { _id: false });

const satReportTemplateSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    templateType: { type: String, enum: ['form', 'file'], default: 'form' },
    // Form type fields
    fields: { type: [fieldSchema], default: [] },
    // File type fields
    fileName: { type: String, default: '' },
    fileData: { type: String, default: '' }, // Base64
    fileType: { type: String, default: '' },
    uploadedBy: { type: String, required: true },
    assignedEmployees: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now, expires: 2592000 }
  },
  { versionKey: false }
);

satReportTemplateSchema.index({ createdAt: -1 });
export default mongoose.model('SatReportTemplate', satReportTemplateSchema);

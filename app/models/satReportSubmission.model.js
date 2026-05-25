import mongoose from 'mongoose';

const responseSchema = new mongoose.Schema({
  fieldLabel: { type: String, required: true },
  value: { type: String, default: '' },
  isHtml: { type: Boolean, default: false }
}, { _id: false });

const satReportSubmissionSchema = new mongoose.Schema(
  {
    templateId: { type: String, required: true },
    templateTitle: { type: String, required: true },
    templateType: { type: String, enum: ['form', 'file'], default: 'form' },
    employeeUsername: { type: String, required: true },
    employeeName: { type: String, required: true },
    responses: { type: [responseSchema], default: [] },
    fileName: { type: String, default: '' },
    fileData: { type: String, default: '' },
    fileType: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now, expires: 2592000 }
  },
  { versionKey: false }
);

satReportSubmissionSchema.index({ createdAt: -1 });
export default mongoose.model('SatReportSubmission', satReportSubmissionSchema);

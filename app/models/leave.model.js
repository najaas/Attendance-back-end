import mongoose from 'mongoose';
import { getLocalDateString } from '../utils/helpers.js';

const leaveSchema = new mongoose.Schema(
  {
    employeeUsername: { type: String, required: true, trim: true, index: true },
    employeeName: { type: String, required: true, trim: true },
    leaveType: { type: String, enum: ['annual', 'sick', 'emergency', 'unpaid', 'other'], default: 'annual' },
    fromDate: { type: String, required: true, index: true },
    toDate: { type: String, required: true },
    days: { type: Number, required: true, min: 0.5 },
    reason: { type: String, required: true, trim: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    adminNote: { type: String, default: '', trim: true },
    reviewedBy: { type: String, default: '', trim: true },
    reviewedAt: { type: Date, default: null },
    appliedDate: { type: String, default: () => getLocalDateString() },
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model('Leave', leaveSchema);

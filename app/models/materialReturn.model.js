import mongoose from 'mongoose';

const materialReturnSchema = new mongoose.Schema(
  {
    projectName: { type: String, required: true, trim: true },
    jobNumber: { type: String, required: true, trim: true },
    clientName: { type: String, trim: true, default: '' },
    date: { type: String, required: true, index: true }, // Format YYYY-MM-DD
    returnedBy: { type: String, required: true, index: true, trim: true }, // Employee username
    employeeName: { type: String, required: true, trim: true }, // Employee display name
    items: [
      {
        slNo: { type: String, default: '' },
        jobNo: { type: String, trim: true, default: '' },
        panelRef: { type: String, trim: true, default: '' },
        description: { type: String, required: true, trim: true },
        qty: { type: String, required: true, trim: true },
        remarks: { type: String, trim: true, default: '' }
      }
    ],
    remarks: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['pending', 'verified'], default: 'pending', index: true }
  },
  { 
    timestamps: true,
    versionKey: false 
  }
);

materialReturnSchema.index({ createdAt: -1 });

export default mongoose.model('MaterialReturn', materialReturnSchema);

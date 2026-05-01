import mongoose from 'mongoose';

const fsrSchema = new mongoose.Schema({
  project: String,
  jobRef: String,
  client: String,
  date: String,
  purpose: String,
  timeInOut: String,
  contact: String,
  transport: String,
  switchboardRef: String,
  location: String,
  serviceDetails: String,
  observation: String,
  items: [{
    jobNo: String,
    slNo: String,
    panelRef: String,
    material: String,
    qty: String,
    completionDate: String,
    doneBy: String
  }],
  conclusion: String,
  techOrg: String,
  techName: String,
  techDesignation: String,
  techDate: String,
  clientOrg: String,
  clientName: String,
  clientDesignation: String,
  clientDate: String,
  othersOrg: String,
  othersName: String,
  othersDesignation: String,
  othersDate: String,
  techSignature: String,
  clientSignature: String,
  othersSignature: String,
  assignedEmployees: [String],
  formType: { type: String, default: 'table' }, // 'table' or 'plain'
  workDonePlain: String,
  status: { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now, expires: 2592000 } // 2592000s = 30 days
});

fsrSchema.index({ createdAt: -1 });
fsrSchema.index({ date: -1 });
fsrSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('FSR', fsrSchema);

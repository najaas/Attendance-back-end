import mongoose from 'mongoose';

const employeeSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    shortName: { type: String, trim: true, default: '' },
    username: { type: String, required: true, unique: true, trim: true, index: true },
    employeeCode: { type: String, required: true, unique: true, trim: true, index: true },
    designation: { type: String, default: '', trim: true },
    companyNumber: { type: String, default: '', trim: true },
    personalNumber: { type: String, default: '', trim: true },
    indiaNumber: { type: String, default: '', trim: true },
    pushTokens: [
      {
        token: { type: String, trim: true },
        platform: { type: String, trim: true, default: '' },
        updatedAt: { type: Date, default: Date.now },
      }
    ],
  },
  { versionKey: false }
);

export default mongoose.model('Employee', employeeSchema);

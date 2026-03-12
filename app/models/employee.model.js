import mongoose from 'mongoose';

const employeeSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true, index: true },
    employeeCode: { type: String, required: true, unique: true, trim: true, index: true },
    designation: { type: String, default: '', trim: true },
  },
  { versionKey: false }
);

export default mongoose.model('Employee', employeeSchema);

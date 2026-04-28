import mongoose from 'mongoose';

const holidaySchema = new mongoose.Schema(
  {
    date: { type: String, required: true, unique: true, index: true }, // YYYY-MM-DD
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['public', 'optional', 'restricted'], default: 'public' },
    description: { type: String, default: '', trim: true },
    createdBy: { type: String, default: '', trim: true },
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model('Holiday', holidaySchema);

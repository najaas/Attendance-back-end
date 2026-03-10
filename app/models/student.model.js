import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
  },
  { versionKey: false }
);

export default mongoose.model('Student', studentSchema);

import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, unique: true, index: true },
    entries: { type: Map, of: String, default: {} },
  },
  { versionKey: false }
);

export default mongoose.model('Attendance', attendanceSchema);

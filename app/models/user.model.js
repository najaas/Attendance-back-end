import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    username: { type: String, required: true, unique: true, trim: true, index: true },
    password: { type: String, required: true },
    role: { type: String, required: true, enum: ['admin', 'employee'] },
    name: { type: String, trim: true, default: '' },
    shortName: { type: String, trim: true, default: '' },
  },
  { versionKey: false }
);

export default mongoose.model('User', userSchema);

import mongoose from 'mongoose';
import { getLocalDateString } from '../utils/helpers.js';

const workScheduleSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    jobNumber: { type: String, default: '', trim: true },
    projectName: { type: String, default: '', trim: true },
    customerName: { type: String, default: '', trim: true },
    taskDate: { type: String, required: true, index: true, default: () => getLocalDateString() },
    location: { type: String, default: '', trim: true },
    site: { type: String, default: 'All Sites', trim: true },
    vehicle: { type: String, default: '', trim: true },
    assignedToUsername: { type: String, required: true, trim: true, index: true },
    assignedToName: { type: String, required: true, trim: true },
    assignedByUsername: { type: String, required: true, trim: true },
    status: { type: String, enum: ['pending', 'completed'], default: 'pending', index: true },
    completionNote: { type: String, default: '', trim: true },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model('WorkSchedule', workScheduleSchema);

import mongoose from 'mongoose';
import { getLocalDateString } from '../utils/helpers.js';

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    priority: { type: String, enum: ['normal', 'important', 'urgent'], default: 'normal' },
    targetAudience: { type: String, enum: ['all', 'specific'], default: 'all' },
    targetUsernames: [{ type: String, trim: true }],
    expiresAt: { type: String, default: '' }, // YYYY-MM-DD, empty = no expiry
    postedBy: { type: String, required: true, trim: true },
    postedDate: { type: String, default: () => getLocalDateString() },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model('Announcement', announcementSchema);

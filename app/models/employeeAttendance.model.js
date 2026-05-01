import mongoose from 'mongoose';

const employeeAttendanceSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, index: true },
    employeeUsername: { type: String, required: true, trim: true, index: true },
    employeeName: { type: String, required: true, trim: true },
    employeeShortName: { type: String, trim: true, default: '' },
    officeEntryTime: { type: String, required: true, trim: true },
    officeExitTime: { type: String, default: '', trim: true },
    vehicle: { type: String, default: '', trim: true },
    breakMinutes: { type: Number, default: 0 },
    locationLat: { type: Number },
    locationLng: { type: Number },
    locationString: { type: String, trim: true },
    site1EntrySubmitTs: String, site1EntrySubmitLat: Number, site1EntrySubmitLng: Number,
    site1ExitSubmitTs: String, site1ExitSubmitLat: Number, site1ExitSubmitLng: Number,
    site2EntrySubmitTs: String, site2EntrySubmitLat: Number, site2EntrySubmitLng: Number,
    site2ExitSubmitTs: String, site2ExitSubmitLat: Number, site2ExitSubmitLng: Number,
    site3EntrySubmitTs: String, site3EntrySubmitLat: Number, site3EntrySubmitLng: Number,
    site3ExitSubmitTs: String, site3ExitSubmitLat: Number, site3ExitSubmitLng: Number,
    site4EntrySubmitTs: String, site4EntrySubmitLat: Number, site4EntrySubmitLng: Number,
    site4ExitSubmitTs: String, site4ExitSubmitLat: Number, site4ExitSubmitLng: Number,
    site5EntrySubmitTs: String, site5EntrySubmitLat: Number, site5EntrySubmitLng: Number,
    site5ExitSubmitTs: String, site5ExitSubmitLat: Number, site5ExitSubmitLng: Number,
    site6EntrySubmitTs: String, site6EntrySubmitLat: Number, site6EntrySubmitLng: Number,
    site6ExitSubmitTs: String, site6ExitSubmitLat: Number, site6ExitSubmitLng: Number,
    officeEntryLat: { type: Number },
    officeEntryLng: { type: Number },
    officeExitLat: { type: Number },
    officeExitLng: { type: Number },
    officeEntrySubmitTs: { type: String, default: '' },
    officeEntrySubmitLat: { type: Number },
    officeEntrySubmitLng: { type: Number },
    officeExitSubmitTs: { type: String, default: '' },
    officeExitSubmitLat: { type: Number },
    officeExitSubmitLng: { type: Number }
  },
  { strict: false, timestamps: true, versionKey: false }
);

employeeAttendanceSchema.index({ date: 1, employeeUsername: 1 }, { unique: true });
employeeAttendanceSchema.index({ date: -1, createdAt: -1 });
employeeAttendanceSchema.index({ employeeUsername: 1, date: -1 });

export default mongoose.model('EmployeeAttendance', employeeAttendanceSchema);

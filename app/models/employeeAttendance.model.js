import mongoose from 'mongoose';

const employeeAttendanceSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, index: true },
    employeeUsername: { type: String, required: true, trim: true, index: true },
    employeeName: { type: String, required: true, trim: true },
    officeEntryTime: { type: String, required: true, trim: true },
    officeExitTime: { type: String, default: '', trim: true },
    breakMinutes: { type: Number, default: 0 },
  },
  { strict: false, timestamps: true, versionKey: false }
);

employeeAttendanceSchema.index({ date: 1, employeeUsername: 1 }, { unique: true });

export default mongoose.model('EmployeeAttendance', employeeAttendanceSchema);

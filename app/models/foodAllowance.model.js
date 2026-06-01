import mongoose from 'mongoose';

const FoodAllowanceSchema = new mongoose.Schema({
  date: { type: String, required: true }, // YYYY-MM-DD
  employeeId: { type: Number, required: true },
  jobNumber: { type: String },
  projectName: { type: String },
  breakfast: { type: Number, default: 0 },
  lunch: { type: Number, default: 0 },
  dinner: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  advance: { type: Number, default: 0 },
  notes: { type: String }
}, { timestamps: true });

// Index for quick queries
FoodAllowanceSchema.index({ date: 1, employeeId: 1 }, { unique: true });

const FoodAllowance = mongoose.model('FoodAllowance', FoodAllowanceSchema);
export default FoodAllowance;

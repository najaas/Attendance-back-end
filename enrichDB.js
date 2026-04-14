import mongoose from 'mongoose';
import dotenv from 'dotenv';
import EmployeeAttendance from './app/models/employeeAttendance.model.js';
import WorkSchedule from './app/models/workSchedule.model.js';

dotenv.config();

const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const lookupScheduleByJobNumber = async (jobNumber, date) => {
  if (!jobNumber) return null;
  const exactJob = String(jobNumber).trim();
  const cleanJob = exactJob.split(',')[0].trim();
  
  let match = null;
  
  const findMatch = async (queryDate) => {
    let q = { taskDate: queryDate };
    
    let m = await WorkSchedule.findOne(queryDate ? { ...q, jobNumber: exactJob } : { jobNumber: exactJob }).sort(queryDate ? {} : { createdAt: -1 }).lean();
    if (!m) m = await WorkSchedule.findOne(queryDate ? { ...q, jobNumber: { $regex: escapeRegex(exactJob), $options: 'i' } } : { jobNumber: { $regex: escapeRegex(exactJob), $options: 'i' } }).sort(queryDate ? {} : { createdAt: -1 }).lean();
    if (!m && exactJob !== cleanJob) m = await WorkSchedule.findOne(queryDate ? { ...q, jobNumber: cleanJob } : { jobNumber: cleanJob }).sort(queryDate ? {} : { createdAt: -1 }).lean();
    if (!m && exactJob !== cleanJob) m = await WorkSchedule.findOne(queryDate ? { ...q, jobNumber: { $regex: escapeRegex(cleanJob), $options: 'i' } } : { jobNumber: { $regex: escapeRegex(cleanJob), $options: 'i' } }).sort(queryDate ? {} : { createdAt: -1 }).lean();
    return m;
  };

  if (date) {
    match = await findMatch(date);
  }
  if (!match) {
    match = await findMatch(null);
  }
  return match;
};

const enrichJobData = async (obj, date, isMongooseDoc) => {
  const checkAndSet = async (jobField, projField, custField, scopeField, vehicleField, locationField) => {
    const jobVal = String((isMongooseDoc ? (obj.get ? obj.get(jobField) : obj[jobField]) : obj[jobField]) || '').trim();
    if (jobVal) {
      const sch = await lookupScheduleByJobNumber(jobVal, date);
      if (sch) {
        const valSet = (field, val) => {
          if (!val) return;
          const currentVal = isMongooseDoc ? (obj.get ? obj.get(field) : obj[field]) : obj[field];
          const cleanCurrent = String(currentVal || '').trim();
          if (!cleanCurrent || cleanCurrent === '-') {
            if (isMongooseDoc) {
              if (obj.set) obj.set(field, val);
              else obj[field] = val;
            } else {
              obj[field] = val;
            }
          }
        };
        valSet(projField, sch.projectName);
        valSet(custField, sch.customerName);
        valSet(scopeField, sch.description || sch.title);
        valSet(vehicleField, sch.vehicle);
        valSet(locationField, sch.location || sch.site);
      }
    }
  };

  await checkAndSet('jobNumber', 'projectName', 'customerName', 'scope', 'vehicle', 'locationString');
  for (let i = 1; i <= 6; i++) {
    await checkAndSet(`site${i}JobNumber`, `site${i}ProjectName`, `site${i}CustomerName`, `site${i}Scope`, `site${i}Vehicle`, `site${i}Location`);
    for (let r = 2; r <= 5; r++) {
      const p = `s${r}_`;
      await checkAndSet(`${p}site${i}JobNumber`, `${p}site${i}ProjectName`, `${p}site${i}CustomerName`, `${p}site${i}Scope`, `${p}site${i}Vehicle`, `${p}site${i}Location`);
    }
  }
};

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/attendance_db')
  .then(async () => {
    console.log('Connected to MongoDB.');
    const records = await EmployeeAttendance.find();
    let count = 0;
    for (const r of records) {
      await enrichJobData(r, r.date, true);
      await r.save({ validateBeforeSave: false });
      count++;
    }
    console.log(`Enriched ${count} records!`);
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

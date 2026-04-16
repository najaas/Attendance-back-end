import EmployeeAttendance from '../models/employeeAttendance.model.js';
import WorkSchedule from '../models/workSchedule.model.js';
import Employee from '../models/employee.model.js';


function docToObject(doc) {
  if (!doc) return null;
  const obj = (doc.toObject ? doc.toObject() : doc);
  const rid = obj._id ? obj._id.toString() : (obj.id || null);
  return { ...obj, id: rid, _id: rid };
}

const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const lookupScheduleByJobNumber = async (jobNumber, date) => {
  if (!jobNumber) return null;
  const exactJob = String(jobNumber).trim();
  const cleanJob = exactJob.split(',')[0].trim();
  
  let match = null;
  
  const findMatch = async (queryDate) => {
    let q = { taskDate: queryDate };
    let qNoDate = {};
    
    // 1. Try exact match
    let m = await WorkSchedule.findOne(queryDate ? { ...q, jobNumber: exactJob } : { jobNumber: exactJob }).sort(queryDate ? {} : { createdAt: -1 }).lean();
    
    // 2. Try regex match with exactJob
    if (!m) m = await WorkSchedule.findOne(queryDate ? { ...q, jobNumber: { $regex: escapeRegex(exactJob), $options: 'i' } } : { jobNumber: { $regex: escapeRegex(exactJob), $options: 'i' } }).sort(queryDate ? {} : { createdAt: -1 }).lean();
    
    // 3. Try exact match with cleanJob (if different)
    if (!m && exactJob !== cleanJob) m = await WorkSchedule.findOne(queryDate ? { ...q, jobNumber: cleanJob } : { jobNumber: cleanJob }).sort(queryDate ? {} : { createdAt: -1 }).lean();
    
    // 4. Try regex match with cleanJob
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

export const jobLookup = async (req, res) => {
  try {
    const { jobNumber } = req.params;
    const { date } = req.query;
    const schedule = await lookupScheduleByJobNumber(jobNumber, date);
    if (!schedule) return res.status(404).json({ message: 'Job not found' });
    return res.json({
      projectName: schedule.projectName,
      customerName: schedule.customerName,
      location: schedule.siteLocationName,
      vehicle: schedule.vehicle
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const logEmployeeAttendance = async (req, res) => {
  try {
    const data = req.body;
    if (!data.date || !data.officeEntryTime) return res.status(400).json({ message: 'Date and entry time required' });
    
    // Build the payload
    const payload = {
      date: data.date,
      employeeUsername: req.user.username,
      employeeName: req.user.name || req.user.username,
      officeEntryTime: data.officeEntryTime,
      officeExitTime: data.officeExitTime || '',
      jobNumber: String(data.jobNumber || '').trim(),
      locationLat: data.locationLat || data.lat || null,
      locationLng: data.locationLng || data.lng || null,
      locationString: data.locationString || data.location || '',
    };

    Object.keys(data).forEach(k => {
      if (k.startsWith('office') || k.startsWith('site') || k.startsWith('s2_') || k.startsWith('s3_') || k.startsWith('s4_') || k.startsWith('s5_')) {
        payload[k] = data[k];
      }
    });

    await enrichJobData(payload, payload.date, false);

    // Upsert: update if exists, create if not — prevents E11000 duplicate key errors
    const record = await EmployeeAttendance.findOneAndUpdate(
      { date: data.date, employeeUsername: req.user.username },
      { $set: payload },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return res.json(docToObject(record));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};




export const updateEmployeeAttendance = async (req, res) => {
  try {
    const data = req.body;
    const current = await EmployeeAttendance.findOne({ date: data.date, employeeUsername: req.user.username }).lean();
    if (!current) return res.status(404).json({ message: 'Record not found' });

    // Update standard fields
    if (data.officeEntryTime !== undefined) current.officeEntryTime = data.officeEntryTime;
    if (data.officeExitTime !== undefined) current.officeExitTime = data.officeExitTime;
    if (data.jobNumber !== undefined) current.jobNumber = String(data.jobNumber).trim();
    
    if (data.locationLat || data.lat) current.locationLat = data.locationLat || data.lat;
    if (data.locationLng || data.lng) current.locationLng = data.locationLng || data.lng;
    if (data.locationString || data.location) current.locationString = data.locationString || data.location;

    // Explicitly update all metadata fields including Rounds 2 & 3
    Object.keys(data).forEach(k => {
      if (k.startsWith('office') || k.startsWith('site') || k.startsWith('s2_') || k.startsWith('s3_') || k.startsWith('s4_') || k.startsWith('s5_')) {
        current.set(k, data[k]);
      }
    });

    await enrichJobData(current, current.date, true);

    await current.save();
    return res.json(docToObject(current));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const getEmployeeAttendanceByDate = async (req, res) => {
  try {
    const record = await EmployeeAttendance.findOne({ date: req.params.date, employeeUsername: req.user.username });
    return res.json(docToObject(record));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const getEmployeeAttendanceHistory = async (req, res) => {
  try {
    const records = await EmployeeAttendance.find({ employeeUsername: req.user.username }).sort({ date: -1 }).limit(30).lean();
    return res.json(records.map(docToObject));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};


export const getAllEmployeeAttendance = async (req, res) => {
  try {
    const raw = await EmployeeAttendance.find().sort({ date: -1 }).limit(500).lean();
    const processed = raw.map(docToObject);
    return res.json(processed);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const updateBreakMinutes = async (req, res) => {
  try {
    const { id, breakMinutes, field = 'breakMinutes' } = req.body;
    const record = await EmployeeAttendance.findByIdAndUpdate(id, { [field]: breakMinutes }, { new: true });
    return res.json(docToObject(record));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const adminExportAttendance = async (req, res) => {
  try {
    const records = await EmployeeAttendance.find().sort({ date: -1 }).lean();
    return res.json(records.map(docToObject));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const enrichAttendanceWithSchedule = async (req, res) => {
  try {
    const records = await EmployeeAttendance.find().lean();
    let count = 0;
    for (const r of records) {
      // enrichJobData acts directly on the Mongoose document using .set()
      await enrichJobData(r, r.date, true);
      await r.save({ validateBeforeSave: false });
      count++;
    }
    return res.json({ message: `Success! Enriched ${count} documents.` });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const adminUpdateAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const record = await EmployeeAttendance.findById(id);
    if (!record) return res.status(404).json({ message: 'Record not found' });

    Object.keys(data).forEach(k => {
      record.set(k, data[k]);
    });

    await record.save();
    return res.json(docToObject(record));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const clearRound = async (req, res) => {
  try {
    const { id } = req.params;
    const { roundType } = req.body; // 'R1', 'R2', 'R3', 'R4', 'R5'
    console.log(`[ClearRound] Action for ${roundType} on record ${id}`);

    const record = await EmployeeAttendance.findById(id);
    if (!record) return res.status(404).json({ message: 'Record not found' });

    const round = String(roundType || 'R1').toUpperCase();
    const update = { $unset: {} };
    
    if (round === 'R1') {
      const R1_FIELDS = ['officeEntryTime', 'officeExitTime', 'officeEntryLat', 'officeEntryLng', 'officeExitLat', 'officeExitLng', 'officeEntrySubmitTs', 'officeExitSubmitTs'];
      for (let i = 1; i <= 6; i++) {
        R1_FIELDS.push(`site${i}Entry`, `site${i}Exit`, `site${i}Location`, `site${i}JobNumber`, `site${i}ProjectName`, `site${i}CustomerName`, `site${i}Scope`, `site${i}EntrySubmitTs`, `site${i}ExitSubmitTs`, `site${i}Vehicle`);
      }
      R1_FIELDS.forEach(f => { update.$unset[f] = 1; });
    } else {
      // Map R2, R3, R4, R5 to s2_, s3_, s4_, s5_
      const roundIdx = round.replace('R', '');
      const prefix = `s${roundIdx}_`;
      console.log(`[ClearRound] Using prefix ${prefix} for ${round}`);

      const FIELDS = [`${prefix}officeEntryTime`, `${prefix}officeExitTime`, `${prefix}officeEntrySubmitTs`, `${prefix}officeExitSubmitTs`, `${prefix}vehicle` ];
      for (let i = 1; i <= 6; i++) {
        FIELDS.push(`${prefix}site${i}Entry`, `${prefix}site${i}Exit`, `${prefix}site${i}Location`, `${prefix}site${i}JobNumber`, `${prefix}site${i}ProjectName`, `${prefix}site${i}CustomerName`, `${prefix}site${i}Scope`, `${prefix}site${i}EntrySubmitTs`, `${prefix}site${i}ExitSubmitTs`);
      }
      FIELDS.forEach(f => { update.$unset[f] = 1; });
    }

    const updatedRecord = await EmployeeAttendance.findByIdAndUpdate(id, update, { new: true });
    
    // Check if there's ANYTHING left
    const hasAnyKeys = Object.keys(updatedRecord.toObject()).some(k => {
        if(['_id', 'id', 'employeeUsername', 'employeeName', 'date', 'createdAt', 'updatedAt', '__v'].includes(k)) return false;
        const val = updatedRecord[k];
        if (val === null || val === undefined || val === "") return false;
        return true;
    });

    if(!hasAnyKeys) {
        await EmployeeAttendance.findByIdAndDelete(id);
        console.log(`[ClearRound] Final deletion of doc ${id} (no rounds left)`);
        return res.json({ message: 'Round cleared and empty record removed' });
    }

    return res.json({ message: `${round} cleared successfully` });
  } catch (err) {
    console.error(`[ClearRound] Server Error:`, err);
    return res.status(500).json({ message: err.message });
  }
};

export const deleteEmployeeAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await EmployeeAttendance.findByIdAndDelete(id);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    return res.json({ message: 'Record deleted successfully' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

import EmployeeAttendance from '../models/employeeAttendance.model.js';
import WorkSchedule from '../models/workSchedule.model.js';
import Employee from '../models/employee.model.js';


function docToObject(doc) {
  if (!doc) return null;
  const obj = (doc.toObject ? doc.toObject() : doc);
  const rid = obj._id ? obj._id.toString() : (obj.id || null);
  return { ...obj, id: rid, _id: rid };
}

const lookupScheduleByJobNumber = async (jobNumber, date) => {
  if (!jobNumber) return null;
  let match = null;
  if (date) {
    match = await WorkSchedule.findOne({ jobNumber: String(jobNumber).trim(), taskDate: date }).lean();
  }
  if (!match) {
    match = await WorkSchedule.findOne({ jobNumber: String(jobNumber).trim() }).sort({ date: -1 }).lean();
  }
  return match;
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
    
    const exists = await EmployeeAttendance.findOne({ date: data.date, employeeUsername: req.user.username }).lean();
    if (exists) return res.status(400).json({ message: 'Already recorded' });

    // Explicitly build the payload to ensure all capture fields are included
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

    // Safely copy all dynamic capture/site fields
    Object.keys(data).forEach(k => {
      if (k.startsWith('office') || k.startsWith('site')) {
        payload[k] = data[k];
      }
    });

    const record = await EmployeeAttendance.create(payload);
    return res.json(docToObject(record));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const updateEmployeeAttendance = async (req, res) => {
  try {
    const data = req.body;
    const current = await EmployeeAttendance.findOne({ date: data.date, employeeUsername: req.user.username });
    if (!current) return res.status(404).json({ message: 'Record not found' });

    // Update standard fields
    if (data.officeEntryTime !== undefined) current.officeEntryTime = data.officeEntryTime;
    if (data.officeExitTime !== undefined) current.officeExitTime = data.officeExitTime;
    if (data.jobNumber !== undefined) current.jobNumber = String(data.jobNumber).trim();
    
    if (data.locationLat || data.lat) current.locationLat = data.locationLat || data.lat;
    if (data.locationLng || data.lng) current.locationLng = data.locationLng || data.lng;
    if (data.locationString || data.location) current.locationString = data.locationString || data.location;

    // Explicitly update all metadata fields
    Object.keys(data).forEach(k => {
      if (k.startsWith('office') || k.startsWith('site')) {
        current.set(k, data[k]);
      }
    });

    // Auto-enrich logic
    const effectiveJob = String(current.jobNumber || current.site1JobNumber || '').trim();
    if (effectiveJob) {
      const schedule = await lookupScheduleByJobNumber(effectiveJob, current.date);
      if (schedule) {
        if (!current.projectName) current.projectName = schedule.projectName || '';
        if (!current.customerName) current.customerName = schedule.customerName || '';
        if (!current.vehicle) current.vehicle = schedule.vehicle || '';
      }
    }

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
    const records = await EmployeeAttendance.find({ employeeUsername: req.user.username }).sort({ date: -1 }).limit(30);
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
    const { id, breakMinutes } = req.body;
    const record = await EmployeeAttendance.findByIdAndUpdate(id, { breakMinutes }, { new: true });
    return res.json(docToObject(record));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const adminExportAttendance = async (req, res) => {
  try {
    const records = await EmployeeAttendance.find().sort({ date: -1 });
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
      const job = String(r.jobNumber || r.site1JobNumber || '').trim();
      if (job) {
        const sch = await lookupScheduleByJobNumber(job, r.date);
        if (sch) {
          await EmployeeAttendance.updateOne({ _id: r._id }, { 
            $set: { 
              projectName: r.projectName || sch.projectName || '',
              customerName: r.customerName || sch.customerName || '',
              vehicle: r.vehicle || sch.vehicle || ''
            } 
          });
          count++;
        }
      }
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

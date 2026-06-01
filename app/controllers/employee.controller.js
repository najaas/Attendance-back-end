import Employee from '../models/employee.model.js';
import User from '../models/user.model.js';
import Task from '../models/task.model.js';
import { getNextId, parseCSV } from '../utils/helpers.js';
import EmployeeAttendance from '../models/employeeAttendance.model.js';
import WorkSchedule from '../models/workSchedule.model.js';

export const getEmployees = async (req, res) => {
  try {
    const lite = String(req.query?.lite || '').trim() === '1';
    if (lite) {
      res.set('Cache-Control', 'private, max-age=20');
      const employees = await Employee.find({})
        .sort({ id: 1 })
        .select({ _id: 0, id: 1, name: 1, shortName: 1, username: 1, designation: 1, employeeCode: 1 })
        .lean();
      return res.json(employees);
    }

    const employees = await Employee.aggregate([
      { $sort: { id: 1 } },
      {
        $lookup: {
          from: 'users',
          localField: 'username',
          foreignField: 'username',
          as: 'user'
        }
      },
      {
        $addFields: {
          password: { $arrayElemAt: ['$user.password', 0] }
        }
      },
      {
        $project: {
          _id: 0,
          id: 1,
          name: 1,
          shortName: 1,
          username: 1,
          employeeCode: 1,
          designation: 1,
          companyNumber: 1,
          personalNumber: 1,
          indiaNumber: 1,
          password: 1
        }
      }
    ]);
    return res.json(employees);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const addEmployee = async (req, res) => {
  try {
    const { name, shortName, username, password, employeeCode, designation, companyNumber, personalNumber, indiaNumber } = req.body;
    if (!name || !password || !employeeCode) return res.status(400).json({ message: 'Name, Employee ID and password required' });

    const cleanName = String(name).trim();
    const cleanEmployeeCode = String(employeeCode).trim();
    const cleanUsername = String(username || cleanEmployeeCode).trim();
    const userExists = await User.findOne({ username: cleanUsername }).lean();
    if (userExists) return res.status(400).json({ message: 'Username exists' });
    const codeExists = await Employee.findOne({ employeeCode: cleanEmployeeCode }).lean();
    if (codeExists) return res.status(400).json({ message: 'Employee ID exists' });

    const nextId = await getNextId(User, 6);
    await User.create({
      id: nextId,
      username: cleanUsername,
      password: String(password),
      role: 'employee',
      name: cleanName,
      shortName: String(shortName || '').trim(),
    });
    const emp = await Employee.create({
      id: await getNextId(Employee, 6),
      name: cleanName,
      shortName: String(shortName || '').trim(),
      username: cleanUsername,
      employeeCode: cleanEmployeeCode,
      designation: String(designation || '').trim(),
      companyNumber: String(companyNumber || '').trim(),
      personalNumber: String(personalNumber || '').trim(),
      indiaNumber: String(indiaNumber || '').trim(),
    });
    return res.json({ id: emp.id, name: emp.name, shortName: emp.shortName, username: emp.username, employeeCode: emp.employeeCode, designation: emp.designation, companyNumber: emp.companyNumber, personalNumber: emp.personalNumber, indiaNumber: emp.indiaNumber });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const updateEmployee = async (req, res) => {
  try {
    const employeeId = Number(req.params.id);
    const { designation, name, shortName, companyNumber, personalNumber, indiaNumber } = req.body;
    const emp = await Employee.findOne({ id: employeeId });
    if (!emp) return res.status(404).json({ message: 'Not found' });

    if (designation !== undefined) emp.designation = String(designation).trim();
    if (companyNumber !== undefined) emp.companyNumber = String(companyNumber).trim();
    if (personalNumber !== undefined) emp.personalNumber = String(personalNumber).trim();
    if (indiaNumber !== undefined) emp.indiaNumber = String(indiaNumber).trim();
    if (name !== undefined) {
      emp.name = String(name).trim();
      await User.updateOne({ username: emp.username }, { name: emp.name });
    }
    if (shortName !== undefined) {
      emp.shortName = String(shortName).trim();
      await User.updateOne({ username: emp.username }, { shortName: emp.shortName });
    }

    await emp.save();
    return res.json({ id: emp.id, name: emp.name, shortName: emp.shortName, username: emp.username, employeeCode: emp.employeeCode, designation: emp.designation, companyNumber: emp.companyNumber, personalNumber: emp.personalNumber, indiaNumber: emp.indiaNumber });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const deleteEmployee = async (req, res) => {
  try {
    const employeeId = Number(req.params.id);
    const emp = await Employee.findOneAndDelete({ id: employeeId }).lean();
    if (!emp) return res.status(404).json({ message: 'Not found' });
    await User.deleteOne({ username: emp.username });
    await Task.deleteMany({ assignedToEmployeeId: emp.id });
    return res.json({ message: 'Deleted' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const registerPushToken = async (req, res) => {
  try {
    const username = String(req.user?.username || '').trim();
    const expoPushToken = String(req.body?.expoPushToken || '').trim();
    const platform = String(req.body?.platform || '').trim();
    console.log(`[push-token] register request username=${username || '-'} platform=${platform || '-'}`);

    if (!username) {
      console.log('[push-token] rejected unauthorized (missing username in jwt)');
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!expoPushToken) {
      console.log(`[push-token] rejected username=${username} reason=missing_token`);
      return res.status(400).json({ message: 'expoPushToken is required' });
    }
    if (!/^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/.test(expoPushToken)) {
      console.log(`[push-token] rejected username=${username} reason=invalid_format token=${expoPushToken.slice(0, 20)}...`);
      return res.status(400).json({ message: 'Invalid Expo push token' });
    }

    const cleanUsername = username.toLowerCase();
    const employee = await Employee.findOne({ username: { $regex: new RegExp(`^${cleanUsername}$`, 'i') } });
    if (!employee) {
      console.log(`[push-token] rejected username=${username} reason=employee_not_found`);
      return res.status(404).json({ message: 'Employee not found for this user' });
    }

    const existing = Array.isArray(employee.pushTokens) ? employee.pushTokens : [];
    const filtered = existing.filter((entry) => String(entry?.token || '').trim() !== expoPushToken);
    filtered.push({ token: expoPushToken, platform, updatedAt: new Date() });

    employee.pushTokens = filtered.slice(-5);
    await employee.save();
    const masked = expoPushToken.length > 16
      ? `${expoPushToken.slice(0, 12)}...${expoPushToken.slice(-4)}`
      : expoPushToken;
    console.log(`[push-token] saved username=${username} platform=${platform || 'unknown'} token=${masked} total=${employee.pushTokens.length}`);

    return res.json({ message: 'Push token saved' });
  } catch (err) {
    console.log('[push-token] register error:', err.message);
    return res.status(500).json({ message: err.message });
  }
};

export const removePushToken = async (req, res) => {
  try {
    const username = String(req.user?.username || '').trim();
    const expoPushToken = String(req.body?.expoPushToken || '').trim();
    if (!username) return res.status(401).json({ message: 'Unauthorized' });
    if (!expoPushToken) return res.status(400).json({ message: 'expoPushToken is required' });

    await Employee.updateOne(
      { username },
      { $pull: { pushTokens: { token: expoPushToken } } }
    );

    return res.json({ message: 'Push token removed' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const importData = async (req, res) => {
  try {
    const { type, csvData } = req.body;
    const rows = parseCSV(csvData);
    if (rows.length === 0) return res.status(400).json({ message: 'No data found' });

    let count = 0;
    if (type === 'employee-attendance') {
      for (const row of rows) {
        const date = String(row.Date || row.date || '').trim();
        const empCode = String(row['Employee Code'] || row.employeeCode || '').trim();
        const empName = String(row['Employee Name'] || row.employeeName || '').trim();
        
        let emp = null;
        // Try to match by employeeCode first, then by name
        if (empCode) {
          emp = await Employee.findOne({ employeeCode: empCode }).lean();
        }
        if (!emp && empName) {
          emp = await Employee.findOne({ employeeCode: empName }).lean();
        }
        
        if (date && emp) {
          const payload = {
            date,
            employeeId: emp.id,
            officeEntryTime: String(row['Office Entry'] || '').trim(),
            officeExitTime: String(row['Office Exit'] || '').trim(),
            jobNumber: String(row['Job No.'] || '').trim(),
          };
          Object.keys(row).forEach((k) => {
            if (k.toLowerCase().includes('site')) payload[`site${k.replace(/\s+/g, '')}`] = row[k];
          });
          await EmployeeAttendance.updateOne({ date, employeeId: emp.id }, { $set: payload }, { upsert: true });
          count++;
        }
      }
    } else if (type === 'schedule') {
        const firstId = await getNextId(WorkSchedule, 0);
        const docs = [];
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const techId = String(row['Employee Code'] || row['Employee ID'] || row['Technician ID'] || row['Technician Username'] || '').trim();
            const emp = techId
              ? (await Employee.findOne({ employeeCode: techId }).lean()
                || await Employee.findOne({ username: techId }).lean())
              : null;
            if (emp) {
                docs.push({
                    id: firstId + i,
                    title: String(row['Scope of Work'] || 'Imported Task').trim(),
                    taskDate: String(row.Date || '').trim(),
                    jobNumber: String(row['Job No.'] || '').trim(),
                    projectName: String(row['Project Name'] || '').trim(),
                    customerName: String(row.Customer || '').trim(),
                    location: String(row.Location || '').trim(),
                    site: String(row.Site || 'All Sites').trim(),
                    vehicle: String(row['Vehicle No.'] || '').trim(),
                    assignedToEmployeeId: emp.id,
                    assignedByEmployeeId: req.user.id,
                    status: 'pending'
                });
            }
        }
        if (docs.length > 0) {
            const created = await WorkSchedule.insertMany(docs);
            count = docs.length;
            try {
                await notifyScheduleAssigned({ schedules: created.map(s => s.toObject ? s.toObject() : s) });
            } catch (err) {
                console.error('[push] import notify failed:', err.message);
            }
        }
    }

    return res.json({ count });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

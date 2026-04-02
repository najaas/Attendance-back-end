import Employee from '../models/employee.model.js';
import User from '../models/user.model.js';
import Task from '../models/task.model.js';
import { getNextId, parseCSV } from '../utils/helpers.js';
import EmployeeAttendance from '../models/employeeAttendance.model.js';
import WorkSchedule from '../models/workSchedule.model.js';

export const getEmployees = async (req, res) => {
  try {
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
    if (!name || !username || !password || !employeeCode) return res.status(400).json({ message: 'All fields required' });

    const cleanUsername = String(username).trim();
    const cleanName = String(name).trim();
    const cleanEmployeeCode = String(employeeCode).trim();
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
    await Task.deleteMany({ assignedToUsername: emp.username });
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

    if (!username) return res.status(401).json({ message: 'Unauthorized' });
    if (!expoPushToken) return res.status(400).json({ message: 'expoPushToken is required' });
    if (!/^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/.test(expoPushToken)) {
      return res.status(400).json({ message: 'Invalid Expo push token' });
    }

    const employee = await Employee.findOne({ username });
    if (!employee) return res.status(404).json({ message: 'Employee not found for this user' });

    const existing = Array.isArray(employee.pushTokens) ? employee.pushTokens : [];
    const filtered = existing.filter((entry) => String(entry?.token || '').trim() !== expoPushToken);
    filtered.push({ token: expoPushToken, platform, updatedAt: new Date() });

    employee.pushTokens = filtered.slice(-5);
    await employee.save();

    return res.json({ message: 'Push token saved' });
  } catch (err) {
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
        const empName = String(row['Employee Name'] || row.employeeName || '').trim();
        if (date && empName) {
          const emp = await Employee.findOne({ name: empName }).lean();
          if (emp) {
            const payload = {
              date,
              employeeUsername: emp.username,
              employeeName: emp.name,
              officeEntryTime: String(row['Office Entry'] || '').trim(),
              officeExitTime: String(row['Office Exit'] || '').trim(),
              jobNumber: String(row['Job No.'] || '').trim(),
            };
            Object.keys(row).forEach((k) => {
              if (k.toLowerCase().includes('site')) payload[`site${k.replace(/\s+/g, '')}`] = row[k];
            });
            await EmployeeAttendance.updateOne({ date, employeeUsername: emp.username }, { $set: payload }, { upsert: true });
            count++;
          }
        }
      }
    } else if (type === 'schedule') {
        const firstId = await getNextId(WorkSchedule, 0);
        const docs = [];
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const techUsername = String(row['Technician Username'] || '').trim();
            const emp = await Employee.findOne({ username: techUsername }).lean();
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
                    assignedToUsername: emp.username,
                    assignedToName: emp.name,
                    assignedToShortName: emp.shortName || '',
                    assignedByUsername: req.user.username,
                    status: 'pending'
                });
            }
        }
        if (docs.length > 0) {
            await WorkSchedule.insertMany(docs);
            count = docs.length;
        }
    }

    return res.json({ count });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

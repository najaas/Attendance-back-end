import Employee from '../models/employee.model.js';
import User from '../models/user.model.js';
import Task from '../models/task.model.js';
import { getNextId, parseCSV } from '../utils/helpers.js';
import Student from '../models/student.model.js';
import EmployeeAttendance from '../models/employeeAttendance.model.js';
import WorkSchedule from '../models/workSchedule.model.js';

export const getEmployees = async (req, res) => {
  try {
    const employees = await Employee.find().sort({ id: 1 }).select({ _id: 0 }).lean();
    return res.json(employees);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const addEmployee = async (req, res) => {
  try {
    const { name, username, password, employeeCode } = req.body;
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
      role: 'student',
      name: cleanName,
    });
    const emp = await Employee.create({
      id: await getNextId(Employee, 6),
      name: cleanName,
      username: cleanUsername,
      employeeCode: cleanEmployeeCode,
    });
    return res.json({ id: emp.id, name: emp.name, username: emp.username, employeeCode: emp.employeeCode });
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

export const importData = async (req, res) => {
  try {
    const { type, csvData } = req.body;
    const rows = parseCSV(csvData);
    if (rows.length === 0) return res.status(400).json({ message: 'No data found' });

    let count = 0;
    if (type === 'students') {
      for (const row of rows) {
        const name = String(row.Name || row.name || '').trim();
        if (name) {
          await Student.updateOne({ name }, { $setOnInsert: { id: await getNextId(Student, 6) } }, { upsert: true });
          count++;
        }
      }
    } else if (type === 'employee-attendance') {
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

import 'dotenv/config';
import { connectDB } from '../app/config/db.config.js';
import Task from '../app/models/task.model.js';
import WorkSchedule from '../app/models/workSchedule.model.js';
import EmployeeAttendance from '../app/models/employeeAttendance.model.js';
import { getLocalDateString } from '../app/utils/helpers.js';

const USERNAME = 'najas';
const NAME = 'najas';
const TODAY = getLocalDateString();

async function upsertTasks() {
  const baseId = 900000;
  const docs = [
    {
      id: baseId + 1,
      title: 'Site inspection',
      description: 'Inspect HVAC unit and record readings',
      jobNumber: 'JOB-101',
      projectName: 'Alpha Plaza',
      customerName: 'Acme Corp',
      taskDate: TODAY,
      location: 'https://maps.google.com?q=Alpha+Plaza',
      site: 'Block A',
      vehicle: 'V-1234',
      assignedToUsername: USERNAME,
      assignedToName: NAME,
      assignedByUsername: 'admin',
      status: 'pending'
    },
    {
      id: baseId + 2,
      title: 'Filter replacement',
      description: 'Replace air filters in AHU-2',
      jobNumber: 'JOB-102',
      projectName: 'Beta Mall',
      customerName: 'Globex',
      taskDate: TODAY,
      location: 'https://maps.google.com?q=Beta+Mall',
      site: 'Service Entry',
      vehicle: 'V-1234',
      assignedToUsername: USERNAME,
      assignedToName: NAME,
      assignedByUsername: 'admin',
      status: 'pending'
    }
  ];

  let upserts = 0;
  for (const doc of docs) {
    const res = await Task.updateOne({ id: doc.id }, { $set: doc }, { upsert: true });
    if (res.upsertedCount || res.modifiedCount) upserts++;
  }
  return { tasks: upserts };
}

async function upsertSchedule() {
  const doc = {
    id: 800001,
    title: 'AC maintenance',
    description: 'Routine maintenance before summer load',
    jobNumber: 'JOB-103',
    projectName: 'Gamma Tower',
    customerName: 'Initech',
    taskDate: TODAY,
    location: 'https://maps.google.com?q=Gamma+Tower',
    site: 'Roof',
    vehicle: 'V-5678',
    officeTime: '09:00',
    siteTime: '10:30',
    assignedToUsername: USERNAME,
    assignedToName: NAME,
    assignedByUsername: 'admin',
    status: 'pending',
    statusDate: TODAY,
    remarks: 'Bring PPE and ladder'
  };

  const res = await WorkSchedule.updateOne({ id: doc.id }, { $set: doc }, { upsert: true });
  return { schedules: res.upsertedCount || res.modifiedCount ? 1 : 0 };
}

async function upsertAttendance() {
  const payload = {
    date: TODAY,
    employeeUsername: USERNAME,
    employeeName: NAME,
    officeEntryTime: '08:45',
    officeExitTime: '17:30',
    vehicle: 'V-1234',
    breakMinutes: 30,
    site1Location: 'Alpha Plaza',
    site1JobNumber: 'JOB-101',
    site1Entry: '11:00',
    site1Exit: '12:15',
    site2Location: 'Beta Mall',
    site2JobNumber: 'JOB-102',
    site2Entry: '14:00',
    site2Exit: '15:00'
  };

  const res = await EmployeeAttendance.updateOne(
    { date: TODAY, employeeUsername: USERNAME },
    { $set: payload },
    { upsert: true }
  );
  return { attendance: res.upsertedCount || res.modifiedCount ? 1 : 0 };
}

async function main() {
  await connectDB();

  const results = {};
  Object.assign(results, await upsertTasks());
  Object.assign(results, await upsertSchedule());
  Object.assign(results, await upsertAttendance());

  console.log('Seed completed', results);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

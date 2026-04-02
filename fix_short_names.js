import mongoose from 'mongoose';
import dotenv from 'dotenv';
import WorkSchedule from './app/models/workSchedule.model.js';
import Employee from './app/models/employee.model.js';

dotenv.config();

const fixNames = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB Atlas...');

        const schedules = await WorkSchedule.find({});
        console.log(`Scanning ${schedules.length} schedules...`);

        const employees = await Employee.find({}).lean();
        const empMap = new Map();
        employees.forEach(e => {
            empMap.set(e.username, e.shortName || e.name);
            empMap.set(e.name, e.shortName || e.name);
        });

        let updated = 0;
        for (const sch of schedules) {
            const short = empMap.get(sch.assignedToUsername) || empMap.get(sch.assignedToName);
            if (short && sch.assignedToShortName !== short) {
                sch.assignedToShortName = short;
                await sch.save();
                updated++;
            }
        }

        console.log(`Success! Fixed ${updated} schedule records.`);
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
};

fixNames();

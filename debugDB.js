import mongoose from 'mongoose';

mongoose.connect('mongodb://127.0.0.1:27017/attendance_db').then(async () => {
  const searchJob = '7447';
  const docs = await mongoose.connection.db.collection('workschedules').find({ jobNumber: { $regex: searchJob } }).toArray();
  console.log(`Found ${docs.length} schedules matching ${searchJob}:`);
  docs.forEach(doc => {
    console.log(`- ID: ${doc.id}, Job: ${doc.jobNumber}, Project: ${doc.projectName}, Customer: ${doc.customerName}, Scope: ${doc.description || doc.title}`);
  });

  process.exit(0);
});

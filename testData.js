import mongoose from 'mongoose';

mongoose.connect('mongodb://127.0.0.1:27017/attendance').then(async () => {
  const docs = await mongoose.connection.db.collection('workschedules').find({ jobNumber: { $regex: '7447' } }).toArray();
  console.log(JSON.stringify(docs, null, 2));
  process.exit(0);
});

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './app/config/db.config.js';

// Route Imports
import userRoutes from './app/routes/user.routes.js';
import studentRoutes from './app/routes/student.routes.js';
import employeeRoutes from './app/routes/employee.routes.js';
import taskRoutes from './app/routes/task.routes.js';
import attendanceRoutes from './app/routes/attendance.routes.js';
import scheduleRoutes from './app/routes/schedule.routes.js';
import commonRoutes from './app/routes/common.routes.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 5001);

// Middlewares
const allowedOrigins = [
  'https://attendance-front-end-jade.vercel.app', // web frontend (Vercel)
  'https://attendance-back-end.onrender.com',     // backend (Render)
  'http://localhost:3000',                        // local web dev
  'http://localhost:19006',                       // Expo local dev
];
app.use(
  cors({
    origin: (origin, cb) => {
      // allow requests with no origin (mobile apps, curl)
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);
app.options('*', cors());
app.use(express.json());

// Database Connection
connectDB();

// Modular Routes
app.use('/api', userRoutes);           // /api/login, /api/register
app.use('/api/students', studentRoutes);     // /api/students
app.use('/api/employees', employeeRoutes);   // /api/employees
app.use('/api/attendance', attendanceRoutes); // /api/attendance
app.use('/api/tasks', taskRoutes);           // /api/tasks
app.use('/api', scheduleRoutes);             // /api/schedule, /api/work-schedules
app.use('/api', commonRoutes);               // /api/employee-attendance, /api/import-data

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal Server Error' });
});

// Only start the HTTP listener when running locally (not on Vercel serverless)
if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;

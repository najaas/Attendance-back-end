import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './app/config/db.config.js';

// Routes
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

// ----------------------
// ✅ CORS
// ----------------------
const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || [];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error('CORS Not Allowed'));
  },
  credentials: true
}));
app.options('*', cors());

// ----------------------
app.use(express.json());

// Database connection
connectDB();

// Routes
app.use('/api', userRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api', scheduleRoutes);
app.use('/api', commonRoutes);

// Test
app.get('/', (req, res) => res.send('API Running ✅'));

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ ERROR:', err.message);
  res.status(500).json({ message: err.message || 'Internal Server Error' });
});

// Start server
if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on port ${PORT}`));
}

export default app;
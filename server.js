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

// ----------------------
// ✅ CORS CONFIG START
// ----------------------

// convert comma-separated env to array
const parseOrigins = (value = '') =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

// allowed origins
const allowedOrigins = [
  ...parseOrigins(process.env.CORS_ORIGINS),
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:19006',
  'http://localhost:8081',
  'http://localhost:8082',
].filter(Boolean);

// debug log
console.log("✅ Allowed Origins:", allowedOrigins);

// cors options
const corsOptions = {
  origin: (origin, callback) => {
    // allow requests without origin (mobile apps / Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      console.log("❌ Blocked by CORS:", origin);
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

// apply cors
app.use(cors(corsOptions));

// 🔥 VERY IMPORTANT: preflight
app.options('*', cors(corsOptions));

// ----------------------
// ✅ CORS CONFIG END
// ----------------------

app.use(express.json());

// Database Connection
connectDB();

// Routes
app.use('/api', userRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api', scheduleRoutes);
app.use('/api', commonRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: err.message || 'Internal Server Error' });
});

// start server (Render/local)
if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

export default app;
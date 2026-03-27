import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import compression from 'compression';
import { connectDB } from './app/config/db.config.js';

// Route Imports
import userRoutes from './app/routes/user.routes.js';
import employeeRoutes from './app/routes/employee.routes.js';
import taskRoutes from './app/routes/task.routes.js';
import attendanceRoutes from './app/routes/attendance.routes.js';
import scheduleRoutes from './app/routes/schedule.routes.js';
import commonRoutes from './app/routes/common.routes.js';

dotenv.config();

const app = express();
app.use(compression());
const PORT = Number(process.env.PORT || 5001);

// ----------------------
// ✅ SIMPLE CORS (FIXED)
// ----------------------
app.use(cors({
  origin: true,        // 🔥 allow all origins (Vercel + localhost)
  credentials: true
}));

app.options('*', cors()); // 🔥 handle preflight

// ----------------------

app.use(express.json());

// Database Connection
connectDB();

// Routes
app.use('/api', userRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api', scheduleRoutes);
app.use('/api', commonRoutes);

// Test route (optional)
app.get('/', (req, res) => {
  res.send('API Running ✅');
});

// Error handler
app.use((err, req, res, next) => {
  console.error("❌ ERROR:", err.message);
  res.status(500).json({ message: err.message || 'Internal Server Error' });
});

// Start server (Render/local)
if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

export default app;
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
import foodAllowanceRoutes from './app/routes/foodAllowance.routes.js';

dotenv.config();

const app = express();
app.use(compression());
const PORT = Number(process.env.PORT || 5001);

// ----------------------
// 🔒 SECURE CORS — whitelist only
// ----------------------
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (ALLOWED_ORIGINS.indexOf(origin) !== -1 || ALLOWED_ORIGINS.includes('*')) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS blocked for: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Explicitly handle preflight for all routes
app.options('*', cors());

// ----------------------
// 🔒 Security Headers
// ----------------------
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// Limit JSON body size to prevent abuse
app.use(express.json({ limit: '2mb' }));

// Database Connection
connectDB();

// Routes
app.use('/api', userRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api', scheduleRoutes);
app.use('/api', commonRoutes);
app.use('/api/food', foodAllowanceRoutes);

// Health check (public — used by uptime monitors)
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// Error handler
app.use((err, req, res, next) => {
  if (err.message === 'CORS_BLOCKED') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  console.error('ERROR:', err.message);
  res.status(500).json({ message: 'Internal Server Error' });
});

// Start server
if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;

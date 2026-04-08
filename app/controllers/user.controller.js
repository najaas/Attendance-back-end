import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import { getNextId } from '../utils/helpers.js';

const SECRET_KEY = process.env.JWT_SECRET;
const TOKEN_EXPIRY = process.env.JWT_EXPIRY || '12h';   // tokens expire in 12 hours

// Simple in-memory login rate limiter (per IP) — max 10 attempts per 15 min
const loginAttempts = new Map();
const RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip) || { count: 0, windowStart: now };
  if (now - entry.windowStart > RATE_WINDOW_MS) {
    // reset window
    entry.count = 1;
    entry.windowStart = now;
  } else {
    entry.count += 1;
  }
  loginAttempts.set(ip, entry);
  return entry.count > MAX_ATTEMPTS;
}

export const login = async (req, res) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  if (checkRateLimit(ip)) {
    return res.status(429).json({ message: 'Too many login attempts. Please wait 15 minutes.' });
  }

  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
    }
    const user = await User.findOne({ username: String(username).trim() }).lean();
    // Generic error — do not reveal whether username or password is wrong
    if (!user || password !== user.password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, name: user.name || user.username },
      SECRET_KEY,
      { expiresIn: TOKEN_EXPIRY }
    );
    return res.json({ token, role: user.role });
  } catch (err) {
    return res.status(500).json({ message: 'Login failed' });
  }
};

// ⚠️  Register is ADMIN-ONLY — protect this route with adminOnly middleware in user.routes.js
export const register = async (req, res) => {
  try {
    const { username, password, fullName } = req.body;
    if (!username || !password || !fullName) {
      return res.status(400).json({ message: 'All fields required' });
    }

    const cleanUsername = String(username).trim().toLowerCase();
    const cleanName = String(fullName).trim();

    if (cleanUsername.length < 3) {
      return res.status(400).json({ message: 'Username must be at least 3 characters' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const exists = await User.findOne({ username: cleanUsername }).lean();
    if (exists) return res.status(400).json({ message: 'Username already exists' });

    const nextId = await getNextId(User, 6);
    const newUser = await User.create({
      id: nextId,
      username: cleanUsername,
      password: String(password),
      role: 'employee',
      name: cleanName,
    });

    return res.json({ message: 'User created', username: newUser.username, role: newUser.role });
  } catch (err) {
    return res.status(500).json({ message: 'Registration failed' });
  }
};

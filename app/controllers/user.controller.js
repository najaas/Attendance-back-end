import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import { getNextId } from '../utils/helpers.js';

const SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key';

export const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username: String(username || '').trim() }).lean();
    if (!user || password !== user.password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, name: user.name || user.username },
      SECRET_KEY
    );
    return res.json({ token, role: user.role });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const register = async (req, res) => {
  try {
    const { username, password, fullName } = req.body;
    if (!username || !password || !fullName) {
      return res.status(400).json({ message: 'All fields required' });
    }

    const cleanUsername = String(username).trim();
    const cleanName = String(fullName).trim();
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

    const token = jwt.sign(
      { id: newUser.id, username: newUser.username, role: newUser.role, name: newUser.name },
      SECRET_KEY
    );
    return res.json({ token, role: newUser.role });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

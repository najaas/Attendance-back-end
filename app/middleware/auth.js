import jwt from 'jsonwebtoken';

const getSecretKey = () => process.env.JWT_SECRET;

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your-secret-key') {
  console.error('⚠️  SECURITY WARNING: JWT_SECRET is not set or is using the default insecure value. Set a strong random secret in .env');
}

export const auth = (req, res, next) => {
  const authHeader = req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Access denied' });
  }
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access denied' });
  try {
    req.user = jwt.verify(token, getSecretKey());
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Session expired. Please log in again.' });
    }
    return res.status(403).json({ message: 'Invalid token' });
  }
};

export const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admins only' });
  }
  return next();
};

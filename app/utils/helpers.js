import mongoose from 'mongoose';

export const getLocalDateString = (dateObj = new Date()) => {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const getNextId = async (model, floor = 0) => {
  const maxDoc = await model.findOne().sort({ id: -1 }).select({ id: 1, _id: 0 }).lean();
  return Math.max(Number(maxDoc?.id || 0), floor) + 1;
};

export const parseCSV = (csv) => {
  const lines = String(csv || '').split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const vals = line.split(',').map((v) => v.trim());
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = vals[i] || '';
    });
    return obj;
  });
};

export const attendanceDocToRow = (doc) => {
  const entries = doc.entries instanceof Map ? Object.fromEntries(doc.entries) : (doc.entries || {});
  return { date: String(doc.date), ...entries };
};

export const docToObject = (doc) => {
  const raw = doc?.toObject ? doc.toObject() : doc;
  if (!raw) return null;
  const { _id, __v, ...rest } = raw;
  return rest;
};

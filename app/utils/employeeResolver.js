import Employee from '../models/employee.model.js';
import User from '../models/user.model.js';

export const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const codeRegex = (code) => new RegExp(`^${escapeRegex(String(code || '').trim())}$`, 'i');

export const usernameRegex = (username) => new RegExp(`^${escapeRegex(String(username || '').trim())}$`, 'i');

export const findEmployeeByCode = async (code) => {
  const c = String(code || '').trim();
  if (!c) return null;
  return Employee.findOne({ employeeCode: codeRegex(c) }).lean();
};

export const findEmployeeByUsername = async (username) => {
  const u = String(username || '').trim();
  if (!u) return null;
  return Employee.findOne({ username: usernameRegex(u) }).lean();
};

export const findEmployeesByIds = async (ids = []) => {
  const list = [...new Set((ids || []).map((c) => Number(c)).filter(c => !isNaN(c)))];
  if (list.length === 0) return [];
  return Employee.find({ id: { $in: list } })
    .select({ username: 1, name: 1, shortName: 1, employeeCode: 1 })
    .lean();
};

export const findEmployeesByCodes = async (codes = []) => {
  const list = [...new Set((codes || []).map((c) => String(c || '').trim()).filter(Boolean))];
  if (list.length === 0) return [];
  const regexes = list.map(c => codeRegex(c));
  return Employee.find({ employeeCode: { $in: regexes } })
    .select({ username: 1, name: 1, shortName: 1, employeeCode: 1, pushTokens: 1 })
    .lean();
};

/** Resolve login: Employee ID (employeeCode) or legacy username */
export const resolveLoginUser = async (loginId) => {
  const id = String(loginId || '').trim();
  if (!id) return null;

  let user = await User.findOne({ username: id }).lean();
  let employee = user ? await findEmployeeByUsername(user.username) : null;

  if (!user) {
    employee = await findEmployeeByCode(id);
    if (employee) {
      user = await User.findOne({ username: employee.username }).lean();
    }
  }

  if (!user) return null;
  if (!employee && user.role === 'employee') {
    employee = await findEmployeeByUsername(user.username);
  }
  return { user, employee };
};

export const toAssigneePayload = (emp) => ({
  employeeId: emp.id,
});

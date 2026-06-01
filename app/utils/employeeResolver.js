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
  return findEmployeesFromAssignList(ids);
};

/** Resolve employees from Employee ID only (employeeCode, e.g. 2424). */
export const findEmployeesFromAssignList = async (ids = []) => {
  const tokens = [...new Set(
    (Array.isArray(ids) ? ids : [ids])
      .map((v) => String(v ?? '').trim())
      .filter(Boolean)
  )];
  if (tokens.length === 0) return [];

  const codeRegexes = tokens.map((t) => codeRegex(t));
  return Employee.find({ employeeCode: { $in: codeRegexes } })
    .select({ id: 1, username: 1, name: 1, shortName: 1, employeeCode: 1 })
    .lean();
};

export const findEmployeesByCodes = async (codes = []) => {
  const list = [...new Set((codes || []).map((c) => String(c || '').trim()).filter(Boolean))];
  if (list.length === 0) return [];
  const regexes = list.map(c => codeRegex(c));
  return Employee.find({ employeeCode: { $in: regexes } })
    .select({ id: 1, username: 1, name: 1, shortName: 1, employeeCode: 1, pushTokens: 1 })
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

export const toAssigneePayload = (emp) => {
  const employeeCode = String(emp?.employeeCode || '').trim();
  const employeeId = Number(emp?.id);
  return {
    employeeCode,
    employeeId: Number.isFinite(employeeId) ? employeeId : null,
  };
};

const normKey = (value) => String(value || '').trim().toLowerCase();

/** Attendance stores User.id as employeeId — attach userId for frontend lookups. */
export async function attachUserIdsToEmployees(employees = []) {
  if (!Array.isArray(employees) || employees.length === 0) return [];

  const users = await User.find({}).select({ id: 1, username: 1 }).lean();
  const userByKey = new Map();
  for (const u of users) {
    userByKey.set(normKey(u.username), u);
  }

  return employees.map((emp) => {
    const user =
      userByKey.get(normKey(emp.username)) ||
      userByKey.get(normKey(emp.employeeCode));
    return {
      ...emp,
      userId: user?.id ?? null,
    };
  });
}

/** Food/attendance: resolve staff by Employee ID (employeeCode) only. */
export async function buildEmployeeResolverByEmployeeCode() {
  const allEmployees = await Employee.find()
    .select({ id: 1, name: 1, shortName: 1, employeeCode: 1, username: 1 })
    .lean();

  const byCode = new Map();
  for (const e of allEmployees) {
    const code = normKey(e.employeeCode);
    if (code) byCode.set(code, e);
  }

  return (employeeCodeRef) => {
    const code = normKey(String(employeeCodeRef || '').trim());
    if (!code || code === '—') return null;
    return byCode.get(code) || null;
  };
}

/** @deprecated use buildEmployeeResolverByEmployeeCode */
export const buildEmployeeResolverForAttendanceIds = buildEmployeeResolverByEmployeeCode;

/** Display schedule row — Employee ID (code) first; legacy rows may only have internal Employee.id. */
export async function resolveEmployeeForScheduleRow(schedule) {
  const code = String(schedule?.assignedToEmployeeCode || '').trim();
  if (code) {
    const byCode = await findEmployeeByCode(code);
    if (byCode) return byCode;
  }
  const ref = schedule?.assignedToEmployeeId;
  if (ref == null || ref === '') return null;
  const asNum = Number(ref);
  if (Number.isFinite(asNum)) {
    const byInternalId = await Employee.findOne({ id: asNum })
      .select({ id: 1, name: 1, shortName: 1, employeeCode: 1, username: 1 })
      .lean();
    if (byInternalId) return byInternalId;
  }
  return findEmployeeByCode(String(ref).trim());
}

export async function resolveScheduleAssignees(assignMode, assignedToEmployeeIds) {
  const mode = String(assignMode || '').trim();
  if (!mode) return [];

  if (mode === 'all') {
    const employees = await Employee.find()
      .sort({ id: 1 })
      .select({ id: 1, username: 1, name: 1, shortName: 1, employeeCode: 1 })
      .lean();
    return employees.map(toAssigneePayload).filter((a) => a.employeeCode);
  }

  if (mode === 'multiple') {
    const employees = await findEmployeesFromAssignList(assignedToEmployeeIds);
    return employees.map(toAssigneePayload).filter((a) => a.employeeCode);
  }

  const emp = await findEmployeeByCode(mode);
  if (!emp) return [];
  const one = toAssigneePayload(emp);
  return one.employeeCode ? [one] : [];
}

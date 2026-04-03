import Employee from '../models/employee.model.js';
import https from 'https';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK_SIZE = 100;

const isExpoPushToken = (value) => {
  const token = String(value || '').trim();
  return /^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/.test(token);
};

const chunkArray = (items, size) => {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

export const collectPushTokensForUsers = async (usernames = []) => {
  const uniqueUsers = Array.from(new Set((usernames || []).map((u) => String(u || '').trim()).filter(Boolean)));
  if (uniqueUsers.length === 0) return [];

  const employees = await Employee.find({ username: { $in: uniqueUsers } })
    .select({ username: 1, pushTokens: 1 })
    .lean();

  const tokens = [];
  employees.forEach((emp) => {
    (emp.pushTokens || []).forEach((entry) => {
      const token = String(entry?.token || '').trim();
      if (isExpoPushToken(token)) tokens.push({ username: emp.username, token });
    });
  });

  console.log(`[push] token-lookup users=${uniqueUsers.length} employeesFound=${employees.length} validTokens=${tokens.length}`);

  return tokens;
};

export const sendExpoNotifications = async (messages = []) => {
  const valid = (messages || []).filter((m) => isExpoPushToken(m?.to));
  if (valid.length === 0) return { sent: 0 };

  const batches = chunkArray(valid, CHUNK_SIZE);
  let sent = 0;

  for (const batch of batches) {
    const body = await postJson(EXPO_PUSH_URL, batch);
    const errors = Array.isArray(body?.data)
      ? body.data.filter((d) => d?.status === 'error')
      : [];
    if (errors.length > 0) {
      throw new Error(`Expo push ticket error: ${JSON.stringify(errors[0])}`);
    }
    sent += batch.length;
  }

  return { sent };
};

const postJson = (url, payload) =>
  new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = https.request(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`Expo push failed (${res.statusCode}): ${raw}`));
        }
        try {
          resolve(raw ? JSON.parse(raw) : {});
        } catch {
          resolve({});
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(data);
    req.end();
  });

export const notifyScheduleAssigned = async ({ schedules = [] }) => {
  if (!Array.isArray(schedules) || schedules.length === 0) return { sent: 0 };

  const byUser = new Map();
  schedules.forEach((row) => {
    const username = String(row.assignedToUsername || '').trim();
    if (!username) return;
    if (!byUser.has(username)) byUser.set(username, []);
    byUser.get(username).push(row);
  });

  const users = Array.from(byUser.keys());
  if (users.length === 0) return { sent: 0 };
  console.log(`[push] schedule-notify start schedules=${schedules.length} users=${users.join(',')}`);

  const tokens = await collectPushTokensForUsers(users);
  if (tokens.length === 0) return { sent: 0 };

  const messages = tokens.map(({ username, token }) => {
    const rows = byUser.get(username) || [];
    const first = rows[0] || {};
    const taskDate = String(first.taskDate || '').trim();
    const project = String(first.projectName || first.title || 'Work Schedule').trim();
    const count = rows.length;
    const body = count > 1
      ? `${count} schedules assigned. First: ${project}${taskDate ? ` (${taskDate})` : ''}`
      : `${project}${taskDate ? ` on ${taskDate}` : ''}`;

    return {
      to: token,
      sound: 'default',
      title: 'New Schedule Assigned',
      body,
      data: {
        screen: 'schedule',
        taskDate: taskDate || null,
      },
    };
  });

  return sendExpoNotifications(messages);
};

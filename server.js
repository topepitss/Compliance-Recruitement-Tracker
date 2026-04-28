const http = require('http');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = __dirname;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const DATABASE_PATH = path.join(DATA_DIR, 'database.json');
const USERS_PATH = path.join(DATA_DIR, 'users.json');
const ACTIVITY_PATH = path.join(DATA_DIR, 'activity.json');
const DEFAULT_REGISTER_CODE = 'BHEL-PRIVATE-2026';
const REGISTER_CODES = new Set([
  DEFAULT_REGISTER_CODE,
  process.env.REGISTER_CODE
].map(normalizeRegisterCode).filter(Boolean));
const SESSION_COOKIE = 'sustainhealth_session';
const activeSessions = new Map();
const adminRoles = new Set(['superadmin', 'admin']);

function normalizeRegisterCode(value) {
  return String(value || '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .trim()
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .toUpperCase();
}

const defaultData = {
  candidates: [],
  deletedCandidates: [],
  stateRequirements: {
    ACT: ['Photo ID', 'Proof of Address', 'Police Check'],
    QLD: ['Photo ID', 'Work Rights', 'Training Certificate'],
    NSW: ['Photo ID', 'Qualifications', 'Medical Clearance'],
    SA: ['Photo ID', 'Site Induction', 'Insurance'],
    WA: ['Photo ID', 'Drug Test', 'Compliance Training'],
    VIC: ['Photo ID', 'Reference Letter', 'Safety Certificate']
  },
  history: []
};

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.jsx': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedPassword) {
  const [salt, originalHash] = String(storedPassword || '').split(':');
  if (!salt || !originalHash) return false;
  const nextHash = crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(originalHash, 'hex'), Buffer.from(nextHash, 'hex'));
}

function sanitizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

function getCookies(request) {
  return Object.fromEntries(
    String(request.headers.cookie || '')
      .split(';')
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .map((cookie) => {
        const index = cookie.indexOf('=');
        return index === -1
          ? [cookie, '']
          : [cookie.slice(0, index), decodeURIComponent(cookie.slice(index + 1))];
      })
  );
}

function getSession(request) {
  const token = getCookies(request)[SESSION_COOKIE];
  if (!token) return null;
  return activeSessions.get(token) || null;
}

async function getActiveSession(request) {
  const session = getSession(request);
  if (!session) return null;

  const users = await readUsers();
  const user = users.find((item) => item.username === session.username);
  return user && user.approved ? session : null;
}

function isAdminSession(session) {
  return Boolean(session && adminRoles.has(session.role));
}

function getClientIp(request) {
  return String(request.headers['x-forwarded-for'] || request.socket.remoteAddress || 'local')
    .split(',')[0]
    .trim();
}

function sendRedirect(response, location) {
  response.writeHead(302, { Location: location });
  response.end();
}

function setSessionCookie(response, token) {
  response.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`
  );
}

function clearSessionCookie(response) {
  response.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`
  );
}

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  response.end(JSON.stringify(data));
}

async function readDatabase() {
  try {
    const raw = await fs.readFile(DATABASE_PATH, 'utf8');
    return { ...defaultData, ...JSON.parse(raw) };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await writeDatabase(defaultData);
    return defaultData;
  }
}

async function readUsers() {
  try {
    const raw = await fs.readFile(USERS_PATH, 'utf8');
    const users = JSON.parse(raw);
    return Array.isArray(users) ? users : [];
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const defaultUsers = [
      {
        username: 'admin',
        passwordHash: hashPassword('bhel2026'),
        role: 'superadmin',
        approved: true,
        createdAt: new Date().toISOString()
      }
    ];
    await writeUsers(defaultUsers);
    return defaultUsers;
  }
}

async function writeUsers(users) {
  await fs.mkdir(path.dirname(USERS_PATH), { recursive: true });
  await fs.writeFile(USERS_PATH, `${JSON.stringify(users, null, 2)}\n`, 'utf8');
  return users;
}

async function readActivity() {
  try {
    const raw = await fs.readFile(ACTIVITY_PATH, 'utf8');
    const activity = JSON.parse(raw);
    return Array.isArray(activity) ? activity : [];
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await writeActivity([]);
    return [];
  }
}

async function writeActivity(activity) {
  await fs.mkdir(path.dirname(ACTIVITY_PATH), { recursive: true });
  const limitedActivity = Array.isArray(activity) ? activity.slice(-500) : [];
  await fs.writeFile(ACTIVITY_PATH, `${JSON.stringify(limitedActivity, null, 2)}\n`, 'utf8');
  return limitedActivity;
}

async function recordActivity(request, event) {
  const activity = await readActivity();
  const entry = {
    id: crypto.randomUUID(),
    time: new Date().toISOString(),
    username: event.username || 'anonymous',
    action: event.action || 'activity',
    details: event.details || '',
    ip: getClientIp(request)
  };
  activity.push(entry);
  await writeActivity(activity);
  return entry;
}

function publicUser(user) {
  return {
    username: user.username,
    role: user.role || 'user',
    approved: Boolean(user.approved),
    createdAt: user.createdAt || null,
    lastLoginAt: user.lastLoginAt || null
  };
}

function publicCandidate(candidate) {
  return {
    id: candidate.id,
    name: candidate.name || 'Unnamed candidate',
    role: candidate.role || '',
    states: Array.isArray(candidate.states) ? candidate.states : [],
    completed: Boolean(candidate.completed),
    missingDocs: Array.isArray(candidate.missingDocs) ? candidate.missingDocs : [],
    riskAssessment: candidate.riskAssessment || '',
    complianceNotes: candidate.complianceNotes || '',
    afterhoursNotes: candidate.afterhoursNotes || '',
    qcNotes: candidate.qcNotes || '',
    dateAdded: candidate.dateAdded || null,
    completedDate: candidate.completedDate || null,
    completedAt: candidate.completedAt || null,
    deletedDate: candidate.deletedDate || null,
    deletedAt: candidate.deletedAt || null
  };
}

function getLatestTrackerAction(history) {
  if (!Array.isArray(history) || !history.length) return null;
  const latest = history[history.length - 1];
  return latest && latest.action
    ? `${latest.action}${latest.timestamp ? ` at ${latest.timestamp}` : ''}`
    : null;
}

async function ensureDefaultSuperAdmin() {
  const users = await readUsers();
  const admin = users.find((user) => user.username === 'admin');
  let changed = false;

  if (admin && admin.role !== 'superadmin') {
    admin.role = 'superadmin';
    admin.approved = true;
    changed = true;
  }

  if (!users.some((user) => user.role === 'superadmin')) {
    users.push({
      username: 'admin',
      passwordHash: hashPassword('bhel2026'),
      role: 'superadmin',
      approved: true,
      createdAt: new Date().toISOString()
    });
    changed = true;
  }

  if (changed) await writeUsers(users);
  return users;
}

async function writeDatabase(data) {
  await fs.mkdir(path.dirname(DATABASE_PATH), { recursive: true });
  const nextData = {
    candidates: Array.isArray(data.candidates) ? data.candidates : [],
    deletedCandidates: Array.isArray(data.deletedCandidates) ? data.deletedCandidates : [],
    stateRequirements: data.stateRequirements && typeof data.stateRequirements === 'object'
      ? data.stateRequirements
      : defaultData.stateRequirements,
    history: Array.isArray(data.history) ? data.history : []
  };

  await fs.writeFile(DATABASE_PATH, `${JSON.stringify(nextData, null, 2)}\n`, 'utf8');
  return nextData;
}

async function readRequestBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const body = Buffer.concat(chunks).toString('utf8');
  return body ? JSON.parse(body) : {};
}

function getSafeFilePath(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split('?')[0]);
  const requestedPath = cleanPath === '/' ? '/index.html' : cleanPath;
  const filePath = path.normalize(path.join(PUBLIC_DIR, requestedPath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    return null;
  }

  return filePath;
}

async function serveStaticFile(request, response) {
  if (request.url.startsWith('/data/')) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  const filePath = getSafeFilePath(request.url);

  if (!filePath) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  const pageName = path.basename(filePath).toLowerCase();
  if (['tracker.html', 'change-password.html'].includes(pageName) && !(await getActiveSession(request))) {
    sendRedirect(response, '/login.html');
    return;
  }

  if (pageName === 'admin.html' && !isAdminSession(await getActiveSession(request))) {
    sendRedirect(response, '/login.html');
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      'Content-Type': contentTypes[extension] || 'application/octet-stream'
    });
    response.end(file);
  } catch (error) {
    response.writeHead(404, {
      'Content-Type': 'text/plain; charset=utf-8'
    });
    response.end('Not found');
  }
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.url.startsWith('/api/auth/me') && request.method === 'GET') {
      const session = await getActiveSession(request);
      sendJson(response, session ? 200 : 401, {
        authenticated: Boolean(session),
        username: session?.username || null,
        role: session?.role || null,
        isAdmin: isAdminSession(session)
      });
      return;
    }

    if (request.url.startsWith('/api/auth/login') && request.method === 'POST') {
      const body = await readRequestBody(request);
      const username = sanitizeUsername(body.username);
      const password = String(body.password || '');
      const users = await readUsers();
      const user = users.find((item) => item.username === username);

      if (!user || !verifyPassword(password, user.passwordHash)) {
        await recordActivity(request, {
          username,
          action: 'login_failed',
          details: 'Invalid username, password, or disabled account.'
        });
        sendJson(response, 401, { ok: false, message: 'Incorrect username or password.' });
        return;
      }

      if (!user.approved) {
        await recordActivity(request, {
          username,
          action: 'login_disabled',
          details: 'Disabled account attempted to sign in.'
        });
        sendJson(response, 403, { ok: false, message: 'Your account has been disabled by the admin.' });
        return;
      }

      user.lastLoginAt = new Date().toISOString();
      await writeUsers(users);

      const token = crypto.randomBytes(32).toString('hex');
      activeSessions.set(token, {
        username: user.username,
        role: user.role || 'user',
        createdAt: Date.now()
      });
      setSessionCookie(response, token);
      await recordActivity(request, {
        username: user.username,
        action: 'login',
        details: 'User signed in.'
      });
      sendJson(response, 200, { ok: true, username: user.username, role: user.role || 'user' });
      return;
    }

    if (request.url.startsWith('/api/auth/register') && request.method === 'POST') {
      const body = await readRequestBody(request);
      const username = sanitizeUsername(body.username);
      const password = String(body.password || '');
      const confirmPassword = String(body.confirmPassword || '');
      const verificationCode = normalizeRegisterCode(body.verificationCode);

      if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
        sendJson(response, 400, { ok: false, message: 'Username must be 3-32 letters, numbers, dots, dashes, or underscores.' });
        return;
      }

      if (password.length < 8) {
        sendJson(response, 400, { ok: false, message: 'Password must be at least 8 characters.' });
        return;
      }

      if (password !== confirmPassword) {
        sendJson(response, 400, { ok: false, message: 'Password confirmation does not match.' });
        return;
      }

      if (!REGISTER_CODES.has(verificationCode)) {
        await recordActivity(request, {
          username,
          action: 'register_blocked',
          details: 'Registration attempted with invalid private verification code.'
        });
        sendJson(response, 403, { ok: false, message: 'Private verification code is required before access can be created.' });
        return;
      }

      const users = await readUsers();
      if (users.some((user) => user.username === username)) {
        sendJson(response, 409, { ok: false, message: 'That username already exists.' });
        return;
      }

      users.push({
        username,
        passwordHash: hashPassword(password),
        role: 'user',
        approved: true,
        createdAt: new Date().toISOString()
      });
      await writeUsers(users);
      await recordActivity(request, {
        username,
        action: 'register',
        details: 'Verified account created.'
      });
      sendJson(response, 201, { ok: true, message: 'Account verified and created. You can login now.' });
      return;
    }

    if (request.url.startsWith('/api/auth/change-password') && request.method === 'POST') {
      const session = await getActiveSession(request);
      if (!session) {
        sendJson(response, 401, { ok: false, message: 'Login required or account disabled.' });
        return;
      }

      const body = await readRequestBody(request);
      const currentPassword = String(body.currentPassword || '');
      const newPassword = String(body.newPassword || '');
      const confirmPassword = String(body.confirmPassword || '');
      const users = await readUsers();
      const user = users.find((item) => item.username === session.username);

      if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
        sendJson(response, 400, { ok: false, message: 'Current password is incorrect.' });
        return;
      }

      if (newPassword.length < 8) {
        sendJson(response, 400, { ok: false, message: 'New password must be at least 8 characters.' });
        return;
      }

      if (newPassword !== confirmPassword) {
        sendJson(response, 400, { ok: false, message: 'New password and confirmation do not match.' });
        return;
      }

      user.passwordHash = hashPassword(newPassword);
      await writeUsers(users);
      await recordActivity(request, {
        username: session.username,
        action: 'password_change',
        details: 'User changed password.'
      });
      sendJson(response, 200, { ok: true, message: 'Password updated.' });
      return;
    }

    if (request.url.startsWith('/api/auth/logout') && request.method === 'POST') {
      const token = getCookies(request)[SESSION_COOKIE];
      const session = token ? activeSessions.get(token) : null;
      if (token) activeSessions.delete(token);
      clearSessionCookie(response);
      if (session) {
        await recordActivity(request, {
          username: session.username,
          action: 'logout',
          details: 'User signed out.'
        });
      }
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.url.startsWith('/api/admin/summary') && request.method === 'GET') {
      const session = await getActiveSession(request);
      if (!isAdminSession(session)) {
        sendJson(response, 403, { error: 'Admin access required' });
        return;
      }

      const users = await ensureDefaultSuperAdmin();
      const data = await readDatabase();
      const activity = await readActivity();
      sendJson(response, 200, {
        currentUser: session.username,
        users: users.map(publicUser),
        stats: {
          totalUsers: users.length,
          activeUsers: users.filter((user) => user.approved).length,
          adminUsers: users.filter((user) => adminRoles.has(user.role)).length,
          candidates: data.candidates.length,
          archivedCandidates: data.deletedCandidates.length,
          activityEvents: activity.length
        },
        activity: activity.slice(-120).reverse(),
        completedCandidates: data.candidates
          .filter((candidate) => candidate.completed)
          .map(publicCandidate)
          .sort((a, b) => new Date(b.completedAt || b.completedDate || 0) - new Date(a.completedAt || a.completedDate || 0)),
        deletedCandidates: data.deletedCandidates
          .map(publicCandidate)
          .sort((a, b) => new Date(b.deletedAt || b.deletedDate || 0) - new Date(a.deletedAt || a.deletedDate || 0))
      });
      return;
    }

    if (request.url.startsWith('/api/admin/users') && request.method === 'PATCH') {
      const session = await getActiveSession(request);
      if (!isAdminSession(session)) {
        sendJson(response, 403, { error: 'Admin access required' });
        return;
      }

      const body = await readRequestBody(request);
      const username = sanitizeUsername(body.username);
      const users = await ensureDefaultSuperAdmin();
      const user = users.find((item) => item.username === username);

      if (!user) {
        sendJson(response, 404, { ok: false, message: 'User not found.' });
        return;
      }

      if (user.username === 'admin' && body.approved === false) {
        sendJson(response, 400, { ok: false, message: 'The main super admin account cannot be disabled.' });
        return;
      }

      if (typeof body.approved === 'boolean') {
        user.approved = body.approved;
      }

      if (['user', 'admin', 'superadmin'].includes(body.role)) {
        user.role = body.role;
      }

      if (typeof body.newPassword === 'string' && body.newPassword.length > 0) {
        if (body.newPassword.length < 8) {
          sendJson(response, 400, { ok: false, message: 'New password must be at least 8 characters.' });
          return;
        }

        user.passwordHash = hashPassword(body.newPassword);
      }

      await writeUsers(users);
      await recordActivity(request, {
        username: session.username,
        action: 'user_update',
        details: `Updated ${user.username}: role ${user.role}, ${user.approved ? 'approved' : 'disabled'}${body.newPassword ? ', password reset' : ''}.`
      });
      sendJson(response, 200, { ok: true, user: publicUser(user) });
      return;
    }

    if (request.url.startsWith('/api/data') && request.method === 'GET') {
      if (!(await getActiveSession(request))) {
        sendJson(response, 401, { error: 'Login required or account disabled' });
        return;
      }
      sendJson(response, 200, await readDatabase());
      return;
    }

    if (request.url.startsWith('/api/data') && request.method === 'PUT') {
      const session = await getActiveSession(request);
      if (!session) {
        sendJson(response, 401, { error: 'Login required or account disabled' });
        return;
      }
      const body = await readRequestBody(request);
      const latestAction = getLatestTrackerAction(body.history);
      const nextData = await writeDatabase(body);
      await recordActivity(request, {
        username: session.username,
        action: 'tracker_save',
        details: latestAction || `Saved ${nextData.candidates.length} active and ${nextData.deletedCandidates.length} archived candidate records.`
      });
      sendJson(response, 200, nextData);
      return;
    }

    await serveStaticFile(request, response);
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: 'Server error' });
  }
});

server.listen(PORT, () => {
  console.log(`SustainHealth tracker running at http://localhost:${PORT}`);
});

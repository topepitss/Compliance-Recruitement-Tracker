const AUTH_CONFIG = {
  sessionKey: 'sustainhealthAuthSession',
  userKey: 'sustainhealthAuthUser',
  roleKey: 'sustainhealthAuthRole',
  logoutKey: 'sustainhealthLogoutSignal'
};

function isLoggedIn() {
  return localStorage.getItem(AUTH_CONFIG.sessionKey) === 'active';
}

function isAdminRole(role) {
  return role === 'admin' || role === 'superadmin';
}

function applyRoleUI(role) {
  document.body.classList.toggle('is-admin', isAdminRole(role));
}

function setLocalSession(username, role = 'user') {
  localStorage.setItem(AUTH_CONFIG.sessionKey, 'active');
  localStorage.setItem(AUTH_CONFIG.userKey, username);
  localStorage.setItem(AUTH_CONFIG.roleKey, role);
  applyRoleUI(role);
}

function clearLocalSession() {
  localStorage.removeItem(AUTH_CONFIG.sessionKey);
  localStorage.removeItem(AUTH_CONFIG.userKey);
  localStorage.removeItem(AUTH_CONFIG.roleKey);
  applyRoleUI('user');
}

function redirectProtectedPageToLogin() {
  if (document.body.dataset.protected === 'true') {
    window.location.replace('login.html');
  }
}

async function postJson(url, data) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(data)
  });
  const result = await response.json().catch(() => ({}));
  return { response, result };
}

async function login(username, password) {
  const { response, result } = await postJson('/api/auth/login', { username, password });

  if (!response.ok || !result.ok) {
    return {
      ok: false,
      message: result.message || 'Incorrect username or password.'
    };
  }

  setLocalSession(result.username || username.trim(), result.role || 'user');
  return {
    ok: true,
    role: result.role || 'user',
    isAdmin: isAdminRole(result.role)
  };
}

async function registerAccount(username, password, confirmPassword, verificationCode) {
  const { response, result } = await postJson('/api/auth/register', {
    username,
    password,
    confirmPassword,
    verificationCode
  });

  return {
    ok: response.ok && result.ok,
    message: result.message || (response.ok ? 'Account created.' : 'Registration failed.')
  };
}

async function changePassword(currentPassword, newPassword, confirmPassword) {
  const { response, result } = await postJson('/api/auth/change-password', {
    currentPassword,
    newPassword,
    confirmPassword
  });

  return {
    ok: response.ok && result.ok,
    message: result.message || (response.ok ? 'Password updated.' : 'Unable to update password.')
  };
}

async function logout() {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin'
    });
  } finally {
    clearLocalSession();
    localStorage.setItem(AUTH_CONFIG.logoutKey, String(Date.now()));
    window.location.href = 'index.html';
  }
}

async function requireLogin() {
  try {
    const response = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (!response.ok) throw new Error('Login required');
    const session = await response.json();
    if (session.authenticated) {
      setLocalSession(session.username || 'user', session.role || 'user');

      if (document.body.dataset.adminPage === 'true' && !session.isAdmin) {
        window.location.replace('tracker.html');
      }

      return;
    }
  } catch (error) {
    clearLocalSession();
    window.location.replace('login.html');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  applyRoleUI(localStorage.getItem(AUTH_CONFIG.roleKey) || 'user');

  const protectedPage = document.body.dataset.protected === 'true';
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const logoutBtn = document.getElementById('logoutBtn');
  const loginError = document.getElementById('loginError');
  const registerMessage = document.getElementById('registerMessage');
  const passwordForm = document.getElementById('passwordForm');
  const passwordMessage = document.getElementById('passwordMessage');

  if (protectedPage) {
    requireLogin();
  }

  window.addEventListener('storage', (event) => {
    if (event.key === AUTH_CONFIG.logoutKey || (event.key === AUTH_CONFIG.sessionKey && event.newValue !== 'active')) {
      clearLocalSession();
      redirectProtectedPageToLogin();
    }
  });

  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const formData = new FormData(loginForm);
      const username = String(formData.get('username') || '');
      const password = String(formData.get('password') || '');
      const result = await login(username, password);

      if (result.ok) {
        window.location.href = result.isAdmin ? 'admin.html' : 'tracker.html';
        return;
      }

      loginError.textContent = result.message;
      loginError.hidden = false;
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const formData = new FormData(registerForm);
      const result = await registerAccount(
        String(formData.get('username') || ''),
        String(formData.get('password') || ''),
        String(formData.get('confirmPassword') || ''),
        String(formData.get('verificationCode') || '')
      );

      registerMessage.textContent = result.message;
      registerMessage.hidden = false;
      registerMessage.classList.toggle('is-success', result.ok);
      registerMessage.classList.toggle('is-error', !result.ok);

      if (result.ok) {
        registerForm.reset();
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }

  if (passwordForm) {
    passwordForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const formData = new FormData(passwordForm);
      const result = await changePassword(
        String(formData.get('currentPassword') || ''),
        String(formData.get('newPassword') || ''),
        String(formData.get('confirmPassword') || '')
      );

      passwordMessage.textContent = result.message;
      passwordMessage.hidden = false;
      passwordMessage.classList.toggle('is-success', result.ok);
      passwordMessage.classList.toggle('is-error', !result.ok);

      if (result.ok) {
        passwordForm.reset();
      }
    });
  }
});

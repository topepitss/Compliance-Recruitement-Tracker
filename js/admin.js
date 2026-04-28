const statIds = ['totalUsers', 'activeUsers', 'adminUsers', 'candidates', 'archivedCandidates', 'activityEvents'];

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}

function formatDate(value) {
  if (!value) return 'Never';
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (response.status === 401 || response.status === 403) {
    window.location.href = 'login.html';
    throw new Error('Admin access required');
  }

  return response.json();
}

function renderStats(stats) {
  statIds.forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.textContent = String(stats[id] || 0);
  });
}

function renderUsers(users) {
  const usersTable = document.getElementById('usersTable');
  usersTable.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'user-row user-row-head';
  header.innerHTML = '<span>User</span><span>Role</span><span>Status</span><span>Last login</span><span>Actions</span>';
  usersTable.appendChild(header);

  users.forEach((user) => {
    const row = document.createElement('div');
    row.className = 'user-row';

    const name = document.createElement('span');
    name.innerHTML = `<strong>${user.username}</strong><small>Created ${formatDate(user.createdAt)}</small>`;

    const roleWrap = document.createElement('span');
    const role = document.createElement('select');
    role.value = user.role;
    role.disabled = user.username === 'admin';
    ['user', 'admin', 'superadmin'].forEach((roleName) => {
      const option = document.createElement('option');
      option.value = roleName;
      option.textContent = roleName;
      role.appendChild(option);
    });
    roleWrap.appendChild(role);

    const status = document.createElement('span');
    status.className = `status-pill ${user.approved ? 'is-active' : 'is-disabled'}`;
    status.textContent = user.approved ? 'Approved' : 'Disabled';

    const lastLogin = document.createElement('span');
    lastLogin.textContent = formatDate(user.lastLoginAt);

    const actions = document.createElement('span');
    actions.className = 'row-actions';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.textContent = 'Save Role';
    saveBtn.title = 'Save changes to this user role and approval status.';
    saveBtn.addEventListener('click', async () => {
      await updateUser(user.username, {
        role: role.value,
        approved: user.approved
      });
    });

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.textContent = user.approved ? 'Disable User' : 'Approve User';
    toggleBtn.title = user.approved
      ? 'Block this user from logging in and using tracker data.'
      : 'Allow this user to login and use the tracker.';
    toggleBtn.disabled = user.username === 'admin';
    toggleBtn.addEventListener('click', async () => {
      await updateUser(user.username, {
        role: role.value,
        approved: !user.approved
      });
    });

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.textContent = 'Reset Pass';
    resetBtn.title = 'Set a new password for this user.';
    resetBtn.addEventListener('click', async () => {
      const nextPassword = prompt(`Enter a new password for ${user.username} (minimum 8 characters):`);
      if (!nextPassword) return;

      if (nextPassword.length < 8) {
        alert('Password must be at least 8 characters.');
        return;
      }

      await updateUser(user.username, {
        role: role.value,
        approved: user.approved,
        newPassword: nextPassword
      });
      alert(`Password updated for ${user.username}.`);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'danger-action';
    deleteBtn.textContent = 'Delete';
    deleteBtn.title = 'Permanently delete this user account.';
    deleteBtn.disabled = user.username === 'admin';
    deleteBtn.addEventListener('click', async () => {
      const confirmed = confirm(`Delete ${user.username}? This cannot be undone.`);
      if (!confirmed) return;
      await deleteUser(user.username);
    });

    actions.append(saveBtn, toggleBtn, resetBtn, deleteBtn);
    row.append(name, roleWrap, status, lastLogin, actions);
    usersTable.appendChild(row);
  });
}

function renderActivity(activity) {
  const activityList = document.getElementById('activityList');
  activityList.innerHTML = '';

  if (!activity.length) {
    activityList.innerHTML = '<p class="empty-state">No activity yet.</p>';
    return;
  }

  activity.forEach((item) => {
    const row = document.createElement('article');
    row.className = 'activity-item';
    row.innerHTML = `
      <span class="activity-icon">${escapeHTML(item.action.slice(0, 1).toUpperCase())}</span>
      <div>
        <strong>${escapeHTML(item.action.replaceAll('_', ' '))}</strong>
        <p>${escapeHTML(item.details || 'No details.')}</p>
        <small>${escapeHTML(item.username)} - ${formatDate(item.time)} - ${escapeHTML(item.ip || 'local')}</small>
      </div>
    `;
    activityList.appendChild(row);
  });
}

function renderRecords(targetId, records, mode) {
  const container = document.getElementById(targetId);
  container.innerHTML = '';

  if (!records.length) {
    container.innerHTML = `<p class="empty-state">No ${mode} records yet.</p>`;
    return;
  }

  records.forEach((record) => {
    const item = document.createElement('article');
    item.className = 'record-card';
    const eventTime = mode === 'completed'
      ? record.completedAt || record.completedDate
      : record.deletedAt || record.deletedDate;
    const docSummary = record.missingDocs && record.missingDocs.length
      ? record.missingDocs.join(', ')
      : 'No missing documents';

    item.innerHTML = `
      <div class="record-card-head">
        <strong>${escapeHTML(record.name)}</strong>
        <span>${escapeHTML(mode)}</span>
      </div>
      <dl>
        <div><dt>Role</dt><dd>${escapeHTML(record.role || '-')}</dd></div>
        <div><dt>State</dt><dd>${escapeHTML((record.states || []).join(', ') || '-')}</dd></div>
        <div><dt>Risk</dt><dd>${escapeHTML(record.riskAssessment || '-')}</dd></div>
        <div><dt>Time</dt><dd>${formatDate(eventTime)}</dd></div>
        <div><dt>Missing docs</dt><dd>${escapeHTML(docSummary)}</dd></div>
        <div><dt>QC notes</dt><dd>${escapeHTML(record.qcNotes || '-')}</dd></div>
      </dl>
    `;
    container.appendChild(item);
  });
}

async function updateUser(username, updates) {
  await requestJson('/api/admin/users', {
    method: 'PATCH',
    body: JSON.stringify({ username, ...updates })
  });
  await loadDashboard();
}

async function deleteUser(username) {
  await requestJson('/api/admin/users', {
    method: 'DELETE',
    body: JSON.stringify({ username })
  });
  await loadDashboard();
}

async function loadDashboard() {
  const data = await requestJson('/api/admin/summary');
  renderStats(data.stats || {});
  renderUsers(data.users || []);
  renderRecords('completedRecords', data.completedCandidates || [], 'completed');
  renderRecords('deletedRecords', data.deletedCandidates || [], 'deleted');
  renderActivity(data.activity || []);
}

document.addEventListener('DOMContentLoaded', loadDashboard);

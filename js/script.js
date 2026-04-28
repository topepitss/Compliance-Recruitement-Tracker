if (typeof isLoggedIn === 'function' && !isLoggedIn()) {
  window.location.replace('login.html');
  throw new Error('Login required');
}

const stateRequirements = {
  ACT: ['Photo ID', 'Proof of Address', 'Police Check'],
  QLD: ['Photo ID', 'Work Rights', 'Training Certificate'],
  NSW: ['Photo ID', 'Qualifications', 'Medical Clearance'],
  SA: ['Photo ID', 'Site Induction', 'Insurance'],
  WA: ['Photo ID', 'Drug Test', 'Compliance Training'],
  VIC: ['Photo ID', 'Reference Letter', 'Safety Certificate']
};

const riskAssessmentOptions = ['In-Progress', 'Cleared(CDN)', 'Not Cleared', 'Not Needed'];
const allStates = ['ACT', 'QLD', 'NSW', 'SA', 'WA', 'VIC'];
const stateVisuals = {
  ACT: { label: 'Capital', color: '#176b87' },
  QLD: { label: 'Coast', color: '#2f9e71' },
  NSW: { label: 'Harbour', color: '#2563eb' },
  SA: { label: 'South', color: '#b7791f' },
  WA: { label: 'West', color: '#7c3aed' },
  VIC: { label: 'Metro', color: '#c2413b' }
};

let history = [];
let databaseEnabled = false;
let saveTimer = null;

const trackerTableBody = document.getElementById('trackerTableBody');
const template = document.getElementById('candidateRowTemplate');
const searchInput = document.getElementById('searchInput');
const viewSelect = document.getElementById('viewSelect');
const statusFilter = document.getElementById('statusFilter');
const stateFilter = document.getElementById('stateFilter');
const sortSelect = document.getElementById('sortSelect');
const addRowBtn = document.getElementById('addRowBtn');
const copyReportBtn = document.getElementById('copyReportBtn');
const dailyReportText = document.getElementById('dailyReportText');
const completedByState = document.getElementById('completedByState');
const deletedByState = document.getElementById('deletedByState');
const sortLabel = document.getElementById('sortLabel');
const completedHistoryBtn = document.getElementById('completedHistoryBtn');
const deletedHistoryBtn = document.getElementById('deletedHistoryBtn');
const markSelectedCompleteBtn = document.getElementById('markSelectedCompleteBtn');
const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
const selectAllCheckbox = document.getElementById('selectAllCheckbox');
const candidateCount = document.getElementById('candidateCount');
const activeStat = document.getElementById('activeStat');
const pendingStat = document.getElementById('pendingStat');
const completedStat = document.getElementById('completedStat');
const missingDocsStat = document.getElementById('missingDocsStat');
const stateDocsList = document.getElementById('stateDocsList');
const candidateModal = document.getElementById('candidateModal');
const candidateForm = document.getElementById('candidateForm');
const closeCandidateModal = document.getElementById('closeCandidateModal');
const cancelCandidateModal = document.getElementById('cancelCandidateModal');

let selectedCandidateIds = new Set();

function generateId() {
  return `cand-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function normalizeCandidate(candidate) {
  return {
    id: candidate.id || generateId(),
    name: candidate.name || 'Unnamed candidate',
    role: candidate.role || '',
    states: Array.isArray(candidate.states) && candidate.states.length ? candidate.states : ['ACT'],
    completed: Boolean(candidate.completed),
    missingDocs: Array.isArray(candidate.missingDocs) ? candidate.missingDocs : [],
    riskAssessment: riskAssessmentOptions.includes(candidate.riskAssessment) ? candidate.riskAssessment : 'In-Progress',
    complianceNotes: candidate.complianceNotes || '',
    afterhoursNotes: candidate.afterhoursNotes || '',
    qcNotes: candidate.qcNotes || '',
    dateAdded: candidate.dateAdded || new Date().toISOString(),
    completedDate: candidate.completedDate,
    completedAt: candidate.completedAt,
    deletedDate: candidate.deletedDate,
    deletedAt: candidate.deletedAt
  };
}

function normalizeCandidateList(list) {
  return Array.isArray(list) ? list.map(normalizeCandidate) : [];
}

function findCandidateById(id) {
  return candidates.find(c => c.id === id) || deletedCandidates.find(c => c.id === id);
}

function escapeHTML(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value = '') {
  return escapeHTML(value).replace(/`/g, '&#96;');
}

function buildArchiveHistoryRows(items, dateField) {
  const today = getTodayString();
  const dateKeys = Array.from(new Set([
    today,
    ...items.map(item => item[dateField] || 'No date saved')
  ])).sort((a, b) => {
    if (a === today) return -1;
    if (b === today) return 1;
    if (a === 'No date saved') return 1;
    if (b === 'No date saved') return -1;
    return new Date(b) - new Date(a);
  });

  return dateKeys.map(dateKey => {
    const itemsForDate = items.filter(item => (item[dateField] || 'No date saved') === dateKey);
    const stateCounts = allStates.map(state => {
      const count = itemsForDate.filter(candidate => candidate.states.includes(state)).length;
      return getStateHistoryChip(state, count);
    }).join('');
    const label = dateKey === today
      ? 'Today'
      : dateKey === 'No date saved'
        ? 'No date saved'
        : getDisplayDate(dateKey);

    return `
      <li>
        <div class="date-row">${escapeHTML(label)} <small>${itemsForDate.length} total</small></div>
        <div class="state-grid">${stateCounts}</div>
      </li>
    `;
  }).join('');
}

function getStateHistoryChip(state, count) {
  const visual = stateVisuals[state] || stateVisuals.ACT;
  return `
    <span class="state-history-chip" style="--state-color: ${escapeAttribute(visual.color)}">
      <i>${escapeHTML(state)}</i>
      <span>${escapeHTML(visual.label)}</span>
      <strong>${count}</strong>
    </span>
  `;
}

// Auto-save functions
function saveToLocalStorage() {
  localStorage.setItem('candidates', JSON.stringify(candidates));
  localStorage.setItem('deletedCandidates', JSON.stringify(deletedCandidates));
  localStorage.setItem('stateRequirements', JSON.stringify(stateRequirements));
  localStorage.setItem('history', JSON.stringify(history));
  saveToDatabase();
}

function getDatabasePayload() {
  return {
    candidates,
    deletedCandidates,
    stateRequirements,
    history
  };
}

async function saveToDatabaseNow() {
  if (!databaseEnabled) return;

  try {
    const response = await fetch('/api/data', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(getDatabasePayload())
    });

    if (!response.ok) {
      throw new Error('Database save failed');
    }
  } catch (error) {
    console.warn('Could not save to shared database. Local backup was saved instead.', error);
  }
}

function saveToDatabase() {
  if (!databaseEnabled) return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveToDatabaseNow, 250);
}

async function loadFromDatabase() {
  if (window.location.protocol === 'file:') return false;

  try {
    const response = await fetch('/api/data');
    if (!response.ok) return false;

    const data = await response.json();
    const serverHasRows =
      (Array.isArray(data.candidates) && data.candidates.length > 0) ||
      (Array.isArray(data.deletedCandidates) && data.deletedCandidates.length > 0) ||
      (Array.isArray(data.history) && data.history.length > 0);

    databaseEnabled = true;

    if (!serverHasRows && candidates.length > 0) {
      await saveToDatabaseNow();
      return true;
    }

    candidates = normalizeCandidateList(data.candidates);
    deletedCandidates = normalizeCandidateList(data.deletedCandidates);
    history = Array.isArray(data.history) ? data.history : [];

    if (data.stateRequirements && typeof data.stateRequirements === 'object') {
      Object.assign(stateRequirements, data.stateRequirements);
    }

    saveToLocalStorage();
    return true;
  } catch (error) {
    console.warn('Shared database unavailable. Using this browser backup.', error);
    return false;
  }
}

async function loadInitialData() {
  loadFromLocalStorage();
  await loadFromDatabase();
}

function loadFromLocalStorage() {
  const savedCandidates = localStorage.getItem('candidates');
  if (savedCandidates) {
    let parsed = [];
    try {
      parsed = JSON.parse(savedCandidates);
    } catch (error) {
      parsed = [];
    }
    if (parsed && parsed.length > 0) {
      candidates = normalizeCandidateList(parsed);
    } else {
      candidates = normalizeCandidateList(sampleCandidates);
    }
  } else {
    candidates = normalizeCandidateList(sampleCandidates);
  }

  const savedDeleted = localStorage.getItem('deletedCandidates');
  if (savedDeleted) {
    try {
      deletedCandidates = normalizeCandidateList(JSON.parse(savedDeleted));
    } catch (error) {
      deletedCandidates = [];
    }
  }

  const savedStateReq = localStorage.getItem('stateRequirements');
  if (savedStateReq) {
    try {
      Object.assign(stateRequirements, JSON.parse(savedStateReq));
    } catch (error) {
      saveToLocalStorage();
    }
  }

  const savedHistory = localStorage.getItem('history');
  if (savedHistory) {
    try {
      const parsedHistory = JSON.parse(savedHistory);
      history = Array.isArray(parsedHistory) ? parsedHistory : [];
    } catch (error) {
      history = [];
    }
  }
}

function addToHistory(action) {
  history.push({
    timestamp: new Date().toISOString(),
    action,
    candidates: JSON.parse(JSON.stringify(candidates)),
    deletedCandidates: JSON.parse(JSON.stringify(deletedCandidates)),
    stateRequirements: JSON.parse(JSON.stringify(stateRequirements))
  });
  if (history.length > 50) history.shift(); // Keep last 50
  saveToLocalStorage();
}

// ---------- HISTORY PANEL FUNCTIONS ----------
function showCompletedHistory() {
  const historyWindow = window.open('', 'CompletedHistory', 'width=650,height=500');
  if (!historyWindow) {
    alert('Please allow pop-ups to view completed history.');
    return;
  }

  const completedCandidates = candidates.filter(candidate => candidate.completed);
  const historyRows = buildArchiveHistoryRows(completedCandidates, 'completedDate');

  historyWindow.document.write(`
    <html>
    <head>
      <title>Completed History</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; margin: 0; padding: 1.5rem; background: #f8f9fa; color: #1a1a1a; }
        h1 { margin: 0 0 1rem; font-size: 1.4rem; }
        .history-card { background: white; border: 1px solid rgba(0,0,0,0.08); border-radius: 12px; padding: 1.25rem; box-shadow: 0 1px 12px rgba(0,0,0,0.06); }
        .history-card p { margin: 0 0 1rem; color: #555; }
        ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.75rem; }
        li { background: #f1f7ff; border: 1px solid rgba(0,102,204,0.12); border-radius: 8px; padding: 0.85rem 1rem; }
        .date-row { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; font-weight: 700; margin-bottom: 0.65rem; }
        .date-row small { color: #555; font-weight: 600; }
        .state-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.5rem; }
        .state-history-chip { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 0.45rem; min-height: 40px; padding: 0.45rem; border: 1px solid color-mix(in srgb, var(--state-color), transparent 72%); border-radius: 8px; background: color-mix(in srgb, var(--state-color), white 90%); }
        .state-history-chip i { display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 8px; background: var(--state-color); color: white; font-size: 0.72rem; font-style: normal; font-weight: 900; }
        .state-history-chip span { color: #555; font-size: 0.78rem; font-weight: 700; }
        .state-history-chip strong { color: var(--state-color); font-size: 1rem; }
        .empty-history { color: #555; }
        button { margin-top: 1rem; border: 1px solid rgba(0,102,204,0.2); background: rgba(0,102,204,0.08); color: #005bb5; border-radius: 8px; padding: 0.75rem 1.1rem; cursor: pointer; }
        button:hover { background: rgba(0,102,204,0.15); }
        @media (max-width: 520px) { .state-grid { grid-template-columns: 1fr; } }
      </style>
    </head>
    <body>
      <div class="history-card">
        <h1>Completed Candidates History</h1>
        <p>All completed candidates grouped by completion date.</p>
        <ul>
          ${historyRows}
        </ul>
        <button onclick="window.close()">Close</button>
      </div>
    </body>
    </html>
  `);
}

function showDeletedHistory() {
  const historyWindow = window.open('', 'DeletedHistory', 'width=650,height=500');
  if (!historyWindow) {
    alert('Please allow pop-ups to view deleted history.');
    return;
  }

  const historyRows = buildArchiveHistoryRows(deletedCandidates, 'deletedDate');

  historyWindow.document.write(`
    <html>
    <head>
      <title>Deleted History</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; margin: 0; padding: 1.5rem; background: #f8f9fa; color: #1a1a1a; }
        h1 { margin: 0 0 1rem; font-size: 1.4rem; }
        .history-card { background: white; border: 1px solid rgba(0,0,0,0.08); border-radius: 12px; padding: 1.25rem; box-shadow: 0 1px 12px rgba(0,0,0,0.06); }
        .history-card p { margin: 0 0 1rem; color: #555; }
        ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.75rem; }
        li { background: #fff4f4; border: 1px solid rgba(220,53,69,0.12); border-radius: 8px; padding: 0.85rem 1rem; }
        .date-row { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; font-weight: 700; margin-bottom: 0.65rem; }
        .date-row small { color: #555; font-weight: 600; }
        .state-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.5rem; }
        .state-history-chip { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 0.45rem; min-height: 40px; padding: 0.45rem; border: 1px solid color-mix(in srgb, var(--state-color), transparent 72%); border-radius: 8px; background: color-mix(in srgb, var(--state-color), white 90%); }
        .state-history-chip i { display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 8px; background: var(--state-color); color: white; font-size: 0.72rem; font-style: normal; font-weight: 900; }
        .state-history-chip span { color: #555; font-size: 0.78rem; font-weight: 700; }
        .state-history-chip strong { color: var(--state-color); font-size: 1rem; }
        .empty-history { color: #555; }
        button { margin-top: 1rem; border: 1px solid rgba(0,0,0,0.12); background: rgba(0,0,0,0.05); color: #1a1a1a; border-radius: 8px; padding: 0.75rem 1.1rem; cursor: pointer; }
        button:hover { background: rgba(0,0,0,0.08); }
        @media (max-width: 520px) { .state-grid { grid-template-columns: 1fr; } }
      </style>
    </head>
    <body>
      <div class="history-card">
        <h1>Deleted Candidates History</h1>
        <p>All deleted candidates grouped by deletion date.</p>
        <ul>
          ${historyRows}
        </ul>
        <button onclick="window.close()">Close</button>
      </div>
    </body>
    </html>
  `);
}

const sampleCandidates = [
  { id: 'cand-aisha', name: 'Aisha Patel', role: 'Compliance Candidate', states: ['ACT'], completed: false, missingDocs: ['Proof of ID', 'Training certificate'], riskAssessment: 'In-Progress', complianceNotes: 'Awaiting background check', afterhoursNotes: 'Available weekends', qcNotes: 'Can book from May 1st', dateAdded: '2026-04-20' },
  { id: 'cand-devon', name: 'Devon Brooks', role: 'People Operations', states: ['WA'], completed: true, missingDocs: [], riskAssessment: 'Cleared(CDN)', complianceNotes: 'All requirements met', afterhoursNotes: 'Not available', qcNotes: 'Available immediately', dateAdded: '2026-04-17', completedDate: '2026-04-27' },
  { id: 'cand-mina', name: 'Mina Shah', role: 'Risk Analyst', states: ['NSW'], completed: false, missingDocs: ['Background check'], riskAssessment: 'In-Progress', complianceNotes: 'Pending verification', afterhoursNotes: 'Contact after 6pm', qcNotes: 'On hold until June', dateAdded: '2026-04-22' },
  { id: 'cand-ethan', name: 'Ethan Carter', role: 'Compliance Auditor', states: ['QLD'], completed: true, missingDocs: [], riskAssessment: 'Cleared(CDN)', complianceNotes: 'Fully compliant', afterhoursNotes: 'Flexible hours', qcNotes: 'Ready for deployment', dateAdded: '2026-04-15', completedDate: '2026-04-26' }
];

let candidates = [];
let deletedCandidates = [];

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-AU');
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDisplayDate(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function getStateRequirementText(state) {
  return stateRequirements[state] ? stateRequirements[state].join(', ') : 'None';
}

function renderStateRequirements() {
  stateDocsList.innerHTML = allStates
    .map(state => {
      const safeState = escapeHTML(state);
      const safeRequirements = escapeHTML(getStateRequirementText(state));
      const visual = stateVisuals[state] || stateVisuals.ACT;
      return `
        <div class="state-card" data-state="${safeState}" onmouseover="highlightState(this)" onmouseout="unhighlightState(this)" onclick="editStateInline(this, '${safeState}')">
          <strong><span class="state-icon" style="background:${escapeAttribute(visual.color)};color:#fff">${safeState}</span>${escapeHTML(visual.label)}</strong>
          <p>${safeRequirements}</p>
        </div>
      `;
    })
    .join('');
}

function highlightState(card) {
  card.style.backgroundColor = 'rgba(40, 167, 69, 0.15)';
}

function unhighlightState(card) {
  card.style.backgroundColor = '';
}

function editStateInline(card, state) {
  const p = card.querySelector('p');
  const originalText = p.textContent;
  p.contentEditable = 'true';
  p.style.backgroundColor = '#f9f9f9';
  p.focus();

  // On blur or enter, save
  p.addEventListener('blur', () => saveStateEdit(p, state, originalText));
  p.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      p.blur();
    }
  });
}

function saveStateEdit(p, state, originalText) {
  const newText = p.textContent.trim();
  if (newText !== originalText) {
    stateRequirements[state] = newText.split(',').map(doc => doc.trim()).filter(Boolean);
    addToHistory(`Edited requirements for ${state}`);
    saveToLocalStorage();
  }
  p.contentEditable = 'false';
  p.style.backgroundColor = '';
  renderStateRequirements();
}

function generateDailyReport() {
  const todayISO = getTodayString();
  const todayLabel = new Date().toLocaleDateString('en-AU');
  const pendingCandidates = candidates.filter(c => !c.completed);
  const completedToday = candidates.filter(c => c.completed && c.completedDate === todayISO);
  const missingDocsCount = candidates.filter(c => c.missingDocs && c.missingDocs.length > 0).length;

  let report = `COMPLIANCE CANDIDATE TRACKER - DAILY REPORT\n`;
  report += `Date: ${todayLabel}\n`;
  report += `${'='.repeat(60)}\n\n`;

  report += `SUMMARY\n`;
  report += `Total Active Candidates: ${candidates.length}\n`;
  report += `Pending: ${pendingCandidates.length}\n`;
  report += `Completed Today: ${completedToday.length}\n`;
  report += `Candidates Missing Documents: ${missingDocsCount}\n\n`;

  report += `STATE BREAKDOWN\n`;
  for (const state of allStates) {
    const active = candidates.filter(c => c.states.includes(state)).length;
    report += `${state}: ${active} candidates\n`;
  }
  report += `\n`;

  report += `PENDING CANDIDATES\n`;
  report += `${'-'.repeat(60)}\n`;
  pendingCandidates.forEach((c, idx) => {
    report += `${idx + 1}. ${c.name} (${c.states.join(', ')}) - ${c.role}\n`;
    report += `   Risk: ${c.riskAssessment} | Missing: ${c.missingDocs.length ? c.missingDocs.join(', ') : 'None'}\n`;
    report += `   Notes: ${c.complianceNotes || 'None'}\n`;
    if (c.afterhoursNotes) report += `   Afterhours: ${c.afterhoursNotes}\n`;
    if (c.qcNotes) report += `   QC: ${c.qcNotes}\n`;
    report += `\n`;
  });

  report += `COMPLETED TODAY\n`;
  report += `${'-'.repeat(60)}\n`;
  completedToday.forEach((c, idx) => {
    report += `${idx + 1}. ${c.name} (${c.states.join(', ')}) - ${c.role}\n`;
    report += `   Risk: ${c.riskAssessment}\n`;
    report += `   Completed: ${formatDate(c.completedDate)}\n`;
    report += `\n`;
  });

  return report;
}

function getTodayString() {
  return getLocalDateString();
}

function updateDailyReport() {
  dailyReportText.value = generateDailyReport();
}

function updateArchiveCounts() {
  const completedCandidates = candidates.filter(candidate => candidate.completed);
  const completedCounts = allStates
    .map(state => {
      const count = completedCandidates.filter(candidate => candidate.states.includes(state)).length;
      return `<span>${escapeHTML(state)}: ${count}</span>`;
    })
    .join('');

  const deletedCounts = allStates
    .map(state => {
      const count = deletedCandidates.filter(candidate => candidate.states.includes(state)).length;
      return `<span>${escapeHTML(state)}: ${count}</span>`;
    })
    .join('');

  completedByState.innerHTML = `
    <div class="archive-total">Total completed: ${completedCandidates.length}</div>
    ${completedCounts}
  `;
  deletedByState.innerHTML = `
    <div class="archive-total">Total deleted: ${deletedCandidates.length}</div>
    ${deletedCounts}
  `;
}

function getFilteredItems(sourceItems) {
  const filterText = searchInput.value.trim().toLowerCase();
  const statusValue = statusFilter.value;
  const stateValue = stateFilter.value;

  return sourceItems.filter(({ candidate }) => {
    const statesList = candidate.states.join(' ');
    const requiredDocsList = candidate.states.map(state => getStateRequirementText(state)).join(' ');
    const text = [
      candidate.name,
      candidate.role,
      statesList,
      candidate.missingDocs.join(' '),
      candidate.completed ? 'completed' : 'pending',
      candidate.riskAssessment,
      candidate.complianceNotes,
      candidate.afterhoursNotes,
      candidate.qcNotes,
      requiredDocsList
    ]
      .join(' ')
      .toLowerCase();
    const matchesText = text.includes(filterText);
    const matchesState = stateValue === 'all' || candidate.states.includes(stateValue);
    const matchesStatus = statusValue === 'all' || (statusValue === 'completed' && candidate.completed) || (statusValue === 'pending' && !candidate.completed);

    return matchesText && matchesState && matchesStatus;
  });
}

function sortItems(items) {
  const direction = sortSelect.value;
  return [...items].sort((a, b) => {
    if (direction === 'nameAsc') {
      return a.candidate.name.localeCompare(b.candidate.name);
    }
    if (direction === 'nameDesc') {
      return b.candidate.name.localeCompare(a.candidate.name);
    }
    if (direction === 'dateNew') {
      return new Date(b.candidate.dateAdded) - new Date(a.candidate.dateAdded);
    }
    if (direction === 'dateOld') {
      return new Date(a.candidate.dateAdded) - new Date(b.candidate.dateAdded);
    }
    return 0;
  });
}

function updateCandidateCount(count) {
  candidateCount.textContent = `Number of Candidates: ${count}`;
}

function updateTrackerStats() {
  const completedTotal = candidates.filter(candidate => candidate.completed).length;
  const pendingTotal = candidates.filter(candidate => !candidate.completed).length;
  const missingDocsTotal = candidates.filter(candidate => candidate.missingDocs && candidate.missingDocs.length > 0).length;

  if (activeStat) activeStat.textContent = String(candidates.length);
  if (pendingStat) pendingStat.textContent = String(pendingTotal);
  if (completedStat) completedStat.textContent = String(completedTotal);
  if (missingDocsStat) missingDocsStat.textContent = String(missingDocsTotal);
}

function getRiskBadge(riskAssessment, candidateId) {
  const classMap = {
    'In-Progress': 'risk-yellow',
    'Cleared(CDN)': 'risk-orange',
    'Not Cleared': 'risk-red',
    'Not Needed': 'risk-green'
  };
  const riskClass = classMap[riskAssessment] || '';
  return `
    <span class="risk-field ${riskClass}">
      <select class="risk-select ${riskClass}" onchange="updateRiskFromSelect(this, '${escapeAttribute(candidateId)}')">
        ${riskAssessmentOptions.map(option => {
          const optClass = classMap[option] || '';
          const safeOption = escapeAttribute(option);
          return `<option value="${safeOption}" class="${optClass}" ${option === riskAssessment ? 'selected' : ''}>${escapeHTML(option)}</option>`;
        }).join('')}
      </select>
    </span>
  `;
}

function renderRows() {
  trackerTableBody.innerHTML = '';

  const view = viewSelect.value;
  let source = view === 'deleted' ? deletedCandidates : candidates;

  let sourceItems = source.map((candidate, index) => ({ candidate, index }));

  if (view === 'completed') {
    sourceItems = sourceItems.filter(item => item.candidate.completed);
  }

  const filtered = getFilteredItems(sourceItems);
  const sorted = sortItems(filtered);
  let forceSave = false;

  sorted.forEach(({ candidate, index: sourceIndex }) => {
    const clone = template.content.cloneNode(true);

    const qcNotesCell = clone.querySelector('.qc-notes-cell');
    const nameCell = clone.querySelector('.name-cell');
    const roleCell = clone.querySelector('.role-cell');
    const stateCell = clone.querySelector('.state-cell');
    const statusCell = clone.querySelector('.status-cell');
    const riskCell = clone.querySelector('.risk-cell');
    const docsCell = clone.querySelector('.docs-cell');
    const requiredDocsCell = clone.querySelector('.required-docs-cell');
    const complianceNotesCell = clone.querySelector('.compliance-notes-cell');
    const afterhoursNotesCell = clone.querySelector('.afterhours-notes-cell');
    const dateCell = clone.querySelector('.date-cell');
  const selectCell = clone.querySelector('.select-cell');
    qcNotesCell.textContent = candidate.qcNotes || '-';
    nameCell.textContent = candidate.name;
    roleCell.textContent = candidate.role;
    stateCell.textContent = candidate.states.join(', ');

    let isCompleted = candidate.completed && candidate.missingDocs.length === 0;
    if (candidate.missingDocs.length > 0 && candidate.completed) {
      candidate.completed = false;
      delete candidate.completedDate;
      delete candidate.completedAt;
      isCompleted = false;
      forceSave = true;
    }

    statusCell.innerHTML = `
      <span class="status-pill ${isCompleted ? 'status-completed' : 'status-pending'}">
        <span class="status-dot-mini" aria-hidden="true"></span>
        ${isCompleted ? 'Completed' : 'Pending'}
      </span>
    `;

    riskCell.innerHTML = getRiskBadge(candidate.riskAssessment, candidate.id);

    docsCell.innerHTML = candidate.missingDocs.length
      ? `<span class="docs-chip-list">${candidate.missingDocs.map(doc => `<span class="docs-chip">${escapeHTML(doc)}</span>`).join('')}</span>`
      : `<span class="docs-none">None</span>`;

    const allRequiredDocs = candidate.states
      .map(state => getStateRequirementText(state))
      .join('; ');

    requiredDocsCell.textContent = allRequiredDocs;
    complianceNotesCell.textContent = candidate.complianceNotes || '-';
    afterhoursNotesCell.textContent = candidate.afterhoursNotes || '-';
    dateCell.textContent = formatDate(candidate.dateAdded);

    // Append FIRST (important fix)
    trackerTableBody.appendChild(clone);

    // Get ACTUAL row from DOM
    const actualRow = trackerTableBody.lastElementChild;
    actualRow.dataset.id = candidate.id;

    const actualToggleBtn = actualRow.querySelector('.toggle-btn');
    const actualEditBtn = actualRow.querySelector('.edit-btn');
    const actualDeleteBtn = actualRow.querySelector('.delete-btn');
    const rowSelect = actualRow.querySelector('.row-select');
    const selectCellActual = actualRow.querySelector('.select-cell');

    if (rowSelect) {
      rowSelect.checked = selectedCandidateIds.has(candidate.id);
      rowSelect.addEventListener('change', () => {
        if (rowSelect.checked) {
          selectedCandidateIds.add(candidate.id);
        } else {
          selectedCandidateIds.delete(candidate.id);
        }
        updateSelectAllCheckbox();
      });

      if (view === 'deleted') {
        selectCellActual.style.opacity = '0.4';
        rowSelect.disabled = true;
      } else {
        selectCellActual.style.opacity = '1';
        rowSelect.disabled = false;
      }
    }

    if (view === 'deleted') {
      actualToggleBtn.style.display = 'none';
      actualEditBtn.style.display = 'none';
      actualDeleteBtn.textContent = 'Restore';

      actualDeleteBtn.addEventListener('click', () => restoreCandidate(sourceIndex));

    } else {
      // Toggle button state depends on missing documents
      if (candidate.missingDocs.length > 0) {
        actualToggleBtn.disabled = true;
        actualToggleBtn.textContent = 'Missing docs';
        actualToggleBtn.classList.remove('completed');
      } else {
        actualToggleBtn.disabled = false;
        actualToggleBtn.textContent = isCompleted ? 'Mark Pending' : 'Mark Completed';
        actualToggleBtn.classList.toggle('completed', isCompleted);
      }

      actualToggleBtn.addEventListener('click', () => {
        if (candidate.missingDocs.length > 0) return;

        candidate.completed = !candidate.completed;

        if (candidate.completed) {
          candidate.completedDate = getTodayString();
          candidate.completedAt = new Date().toISOString();
        } else {
          delete candidate.completedDate;
          delete candidate.completedAt;
        }

        addToHistory(`${candidate.completed ? 'Marked completed' : 'Marked pending'} ${candidate.name}`);
        saveToLocalStorage();
        renderRows();
      });

      actualEditBtn.addEventListener('click', (e) => {
        const row = e.target.closest('tr');
        toggleEditMode(row, candidate, sourceIndex);
      });

      // Delete button
      actualDeleteBtn.textContent = 'Delete';
      actualDeleteBtn.addEventListener('click', () => deleteCandidate(sourceIndex));
    }
  });

  if (forceSave) {
    saveToLocalStorage();
  }

  // Keep everything else working
  updateArchiveCounts();
  updateCandidateCount(sorted.length);
  updateTrackerStats();
  updateDailyReport();
  updateSelectAllCheckbox();
}

function updateSelectAllCheckbox() {
  const view = viewSelect.value;
  const rowCheckboxes = trackerTableBody.querySelectorAll('.row-select');
  if (view === 'deleted') {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.disabled = true;
    return;
  }

  const checkedCount = Array.from(rowCheckboxes).filter(cb => cb.checked).length;
  selectAllCheckbox.disabled = rowCheckboxes.length === 0;
  selectAllCheckbox.checked = rowCheckboxes.length > 0 && checkedCount === rowCheckboxes.length;
}

function processSelectedCandidates(callback) {
  const selectedIds = Array.from(selectedCandidateIds);
  if (!selectedIds.length) return;

  selectedIds.forEach(id => {
    const candidate = candidates.find(c => c.id === id);
    if (candidate) callback(candidate);
  });

  selectedCandidateIds.clear();
  saveToLocalStorage();
  renderRows();
}

function markSelectedCandidatesCompleted() {
  const selectedIds = Array.from(selectedCandidateIds);
  if (!selectedIds.length) return;

  let completedCount = 0;
  selectedIds.forEach(id => {
    const candidate = candidates.find(c => c.id === id);
    if (!candidate) return;
    if (candidate.missingDocs && candidate.missingDocs.length > 0) return;
    candidate.completed = true;
    candidate.completedDate = getTodayString();
    candidate.completedAt = new Date().toISOString();
    completedCount += 1;
  });

  if (completedCount > 0) {
    addToHistory(`Marked ${completedCount} selected candidate(s) completed`);
    selectedCandidateIds.clear();
    saveToLocalStorage();
    renderRows();
  }
}

function deleteSelectedCandidates() {
  const selectedIds = Array.from(selectedCandidateIds);
  if (!selectedIds.length) return;

  const toDelete = candidates.filter(c => selectedCandidateIds.has(c.id));
  toDelete.forEach(candidate => {
    candidate.deletedDate = getTodayString();
    candidate.deletedAt = new Date().toISOString();
    deletedCandidates.unshift(candidate);
  });
  candidates = candidates.filter(c => !selectedCandidateIds.has(c.id));
  selectedCandidateIds.clear();
  if (toDelete.length) {
    addToHistory(`Deleted ${toDelete.length} selected candidate(s)`);
  }
  saveToLocalStorage();
  renderRows();
}

function promptState(defaultState = 'ACT') {
  const input = prompt(`Enter state (${allStates.join(', ')}):`, defaultState);
  if (!input) return null;
  const normalized = input.trim().toUpperCase();
  return allStates.includes(normalized) ? normalized : null;
}

function promptRiskAssessment(defaultRisk = 'In-Progress') {
  const input = prompt(`Enter risk assessment (${riskAssessmentOptions.join(', ')}):`, defaultRisk);
  if (!input) return null;
  const normalized = input.trim();
  return riskAssessmentOptions.includes(normalized) ? normalized : null;
}

function parseCommaList(value) {
  return value ? value.split(',').map(item => item.trim()).filter(Boolean) : [];
}

function setCandidateFormOptions() {
  if (!candidateForm) return;
  const stateSelect = candidateForm.elements.state;
  const riskSelect = candidateForm.elements.riskAssessment;
  stateSelect.innerHTML = allStates
    .map(state => `<option value="${escapeAttribute(state)}">${escapeHTML(state)}</option>`)
    .join('');
  riskSelect.innerHTML = riskAssessmentOptions
    .map(option => `<option value="${escapeAttribute(option)}">${escapeHTML(option)}</option>`)
    .join('');
}

function updateCandidateRequiredDocsPreview() {
  if (!candidateForm) return;
  const state = candidateForm.elements.state.value || 'ACT';
  candidateForm.elements.requiredDocs.value = getStateRequirementText(state);
}

function setCandidateSelectTone(selectElement, classMap) {
  Object.values(classMap).forEach(className => selectElement.classList.remove(className));
  selectElement.classList.add(classMap[selectElement.value] || '');
}

function updateCandidateFormVisuals() {
  if (!candidateForm) return;
  setCandidateSelectTone(candidateForm.elements.status, {
    pending: 'status-pending-select',
    completed: 'status-completed-select'
  });
  setCandidateSelectTone(candidateForm.elements.riskAssessment, {
    'In-Progress': 'risk-in-progress-select',
    'Cleared(CDN)': 'risk-cleared-select',
    'Not Cleared': 'risk-not-cleared-select',
    'Not Needed': 'risk-not-needed-select'
  });
}

function openCandidateModal() {
  if (!candidateModal || !candidateForm) return;
  candidateForm.reset();
  candidateForm.elements.dateAdded.value = getTodayString();
  candidateForm.elements.state.value = 'ACT';
  candidateForm.elements.riskAssessment.value = 'In-Progress';
  candidateForm.elements.status.value = 'pending';
  updateCandidateRequiredDocsPreview();
  updateCandidateFormVisuals();
  candidateModal.hidden = false;
  document.body.classList.add('modal-open');
  window.setTimeout(() => candidateForm.elements.name.focus(), 0);
}

function closeCandidateFormModal() {
  if (!candidateModal) return;
  candidateModal.hidden = true;
  document.body.classList.remove('modal-open');
}

function addCandidate() {
  openCandidateModal();
}

function saveCandidateFromForm(event) {
  event.preventDefault();
  const formData = new FormData(candidateForm);
  const name = String(formData.get('name') || '').trim();
  const role = String(formData.get('role') || '').trim();
  const state = String(formData.get('state') || 'ACT');
  const riskAssessment = String(formData.get('riskAssessment') || 'In-Progress');
  const status = String(formData.get('status') || 'pending');
  const missingDocs = parseCommaList(String(formData.get('missingDocs') || ''));
  const dateValue = String(formData.get('dateAdded') || getTodayString());

  if (!name || !role) return;

  const completed = status === 'completed' && missingDocs.length === 0;
  const dateAdded = new Date(`${dateValue}T00:00:00`).toISOString();
  candidates.unshift({
    id: generateId(),
    name,
    role,
    states: [state],
    completed,
    missingDocs,
    riskAssessment,
    complianceNotes: String(formData.get('complianceNotes') || '').trim(),
    afterhoursNotes: String(formData.get('afterhoursNotes') || '').trim(),
    qcNotes: String(formData.get('qcNotes') || '').trim(),
    dateAdded,
    ...(completed ? { completedDate: getTodayString(), completedAt: new Date().toISOString() } : {})
  });
  addToHistory(`Added candidate ${name}`);
  saveToLocalStorage();
  closeCandidateFormModal();
  renderRows();
}

function toggleEditMode(row, candidate, index) {
  const editBtn = row.querySelector('.edit-btn');

  // =========================
  // ENTER EDIT MODE
  // =========================
  if (editBtn.dataset.mode !== 'editing') {
    editBtn.dataset.mode = 'editing';
    editBtn.textContent = 'Save';

    const setInput = (selector, value) => {
      const cell = row.querySelector(selector);
      const safeValue = value === '-' ? '' : value;
      cell.innerHTML = `<input type="text" value="${escapeAttribute(safeValue)}" class="edit-input">`;
    };

    setInput('.qc-notes-cell', candidate.qcNotes || '');
    setInput('.name-cell', candidate.name);
    setInput('.role-cell', candidate.role);
    setInput('.afterhours-notes-cell', candidate.afterhoursNotes || '');

    // State dropdown
    const stateCell = row.querySelector('.state-cell');
    stateCell.innerHTML = `
      <select class="edit-input">
        ${allStates.map(s => `
          <option value="${escapeAttribute(s)}" ${candidate.states.includes(s) ? 'selected' : ''}>
            ${escapeHTML(s)}
          </option>
        `).join('')}
      </select>
    `;

    // Risk dropdown (EDIT MODE)
    const riskCell = row.querySelector('.risk-cell');
    riskCell.innerHTML = `
      <select class="edit-input">
        ${riskAssessmentOptions.map(r => `
          <option value="${escapeAttribute(r)}" ${candidate.riskAssessment === r ? 'selected' : ''}>
            ${escapeHTML(r)}
          </option>
        `).join('')}
      </select>
    `;

    setInput('.docs-cell', candidate.missingDocs.join(', '));
    setInput('.compliance-notes-cell', candidate.complianceNotes || '');

  }

  // =========================
  // SAVE MODE
  // =========================
  else {
    editBtn.dataset.mode = '';
    editBtn.textContent = 'Saved';
    editBtn.style.backgroundColor = 'green';
    editBtn.style.color = 'white';

    const getValue = (selector) => {
      const input = row.querySelector(selector + ' input');
      return input ? input.value.trim() : '';
    };

    candidate.qcNotes = getValue('.qc-notes-cell');
    candidate.name = getValue('.name-cell');
    candidate.role = getValue('.role-cell');
    candidate.afterhoursNotes = getValue('.afterhours-notes-cell');

    const stateSelect = row.querySelector('.state-cell select');
    candidate.states = stateSelect ? [stateSelect.value] : candidate.states;

    const docsValue = getValue('.docs-cell');
    candidate.missingDocs = docsValue
      ? docsValue.split(',').map(d => d.trim()).filter(Boolean)
      : [];

    if (candidate.missingDocs.length > 0) {
      candidate.completed = false;
      delete candidate.completedDate;
      delete candidate.completedAt;
    }

    candidate.complianceNotes = getValue('.compliance-notes-cell');

    const riskSelect = row.querySelector('.risk-cell select');
    if (riskSelect) candidate.riskAssessment = riskSelect.value;

    addToHistory(`Edited candidate ${candidate.name}`);
    saveToLocalStorage();

    setTimeout(() => {
      renderRows();
    }, 1200);
  }
}

function updateRiskFromSelect(selectElement, candidateId) {
  const candidate = findCandidateById(candidateId);
  if (!candidate) return;
  const selectedValue = selectElement.value;
  candidate.riskAssessment = selectedValue;

  const classMap = {
    'In-Progress': 'risk-yellow',
    'Cleared(CDN)': 'risk-orange',
    'Not Cleared': 'risk-red',
    'Not Needed': 'risk-green'
  };

  // Update dropdown color immediately
  selectElement.className = `risk-select ${classMap[selectedValue] || ''}`;
  const riskField = selectElement.closest('.risk-field');
  if (riskField) riskField.className = `risk-field ${classMap[selectedValue] || ''}`;
  addToHistory(`Updated risk assessment for ${candidate.name}`);
  saveToLocalStorage();
}

function addAdditionalState(index, newState) {
  const candidate = candidates[index];
  if (!candidate.states.includes(newState)) {
    candidate.states.push(newState);
    alert(`Added ${newState}. Current states: ${candidate.states.join(', ')}`);
  } else {
    alert(`${newState} is already assigned to this candidate.`);
  }
  renderRows();
}

function deleteCandidate(index) {
  const candidate = candidates.splice(index, 1)[0];
  candidate.deletedDate = getTodayString();
  candidate.deletedAt = new Date().toISOString();
  deletedCandidates.unshift(candidate);
  addToHistory(`Deleted candidate ${candidate.name}`);
  saveToLocalStorage();
  renderRows();
}

function restoreCandidate(index) {
  const candidate = deletedCandidates.splice(index, 1)[0];
  candidates.unshift(candidate);
  addToHistory(`Restored candidate ${candidate.name}`);
  saveToLocalStorage();
  renderRows();
}

searchInput.addEventListener('input', renderRows);
statusFilter.addEventListener('change', renderRows);
viewSelect.addEventListener('change', renderRows);
stateFilter.addEventListener('change', renderRows);
sortSelect.addEventListener('change', renderRows);
addRowBtn.addEventListener('click', addCandidate);
if (candidateForm) {
  setCandidateFormOptions();
  candidateForm.elements.state.addEventListener('change', updateCandidateRequiredDocsPreview);
  candidateForm.elements.status.addEventListener('change', updateCandidateFormVisuals);
  candidateForm.elements.riskAssessment.addEventListener('change', updateCandidateFormVisuals);
  candidateForm.addEventListener('submit', saveCandidateFromForm);
  updateCandidateFormVisuals();
}
if (closeCandidateModal) closeCandidateModal.addEventListener('click', closeCandidateFormModal);
if (cancelCandidateModal) cancelCandidateModal.addEventListener('click', closeCandidateFormModal);
if (candidateModal) {
  candidateModal.addEventListener('click', (event) => {
    if (event.target === candidateModal) closeCandidateFormModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !candidateModal.hidden) closeCandidateFormModal();
  });
}
copyReportBtn.addEventListener('click', () => {
  const report = dailyReportText.value;
  const markCopied = () => {
    copyReportBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyReportBtn.textContent = 'Copy to Clipboard';
    }, 2000);
  };

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(report).then(markCopied).catch(() => {
      dailyReportText.select();
      document.execCommand('copy');
      markCopied();
    });
    return;
  }

  dailyReportText.select();
  document.execCommand('copy');
  markCopied();
});
completedHistoryBtn.addEventListener('click', showCompletedHistory);
deletedHistoryBtn.addEventListener('click', showDeletedHistory);
selectAllCheckbox.addEventListener('change', () => {
  const checked = selectAllCheckbox.checked;
  selectedCandidateIds.clear();
  trackerTableBody.querySelectorAll('.row-select').forEach(cb => {
    cb.checked = checked;
    const row = cb.closest('tr');
    const id = row && row.dataset.id;
    if (!id) return;
    if (checked) selectedCandidateIds.add(id);
  });
});
markSelectedCompleteBtn.addEventListener('click', markSelectedCandidatesCompleted);
deleteSelectedBtn.addEventListener('click', deleteSelectedCandidates);

loadInitialData().then(() => {
  renderStateRequirements();
  renderRows();
});

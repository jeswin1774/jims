/* ═══════════════════════════════════════════════════════════════
   JIMS — Combined Application JavaScript
   Firebase Firestore Edition
   Covers: Login · Navigation · Home · Dashboard · Attendance · Student Profiles · Add/Edit Student
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ────────────────────────────────────────────────────────────────
   FIREBASE INIT
   ──────────────────────────────────────────────────────────────── */

const firebaseConfig = {
  apiKey: "AIzaSyDhje64cQvAT67I0nMTwzycM4cTHG73flc",
  authDomain: "jims-34a1d.firebaseapp.com",
  projectId: "jims-34a1d",
  storageBucket: "jims-34a1d.firebasestorage.app",
  messagingSenderId: "605971047569",
  appId: "1:605971047569:web:f9015102caa19a44748b30",
  measurementId: "G-FEB2Y2H5E9"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Firestore collection names
const STUDENTS_COL   = 'students';
const ATTENDANCE_COL = 'attendance';

/* ────────────────────────────────────────────────────────────────
   SECTION 1 — ROUTER / SPA NAVIGATION
   ──────────────────────────────────────────────────────────────── */

const PAGES = ['home', 'dashboard', 'attendance', 'profiles', 'add-student'];
const PAGE_TITLES = {
  'home':        ['Home',            'JIMS › Home'],
  'dashboard':   ['Dashboard',       'JIMS › Dashboard'],
  'attendance':  ['Attendance',      'JIMS › Attendance Management'],
  'profiles':    ['Student Profile', 'JIMS › Student Profile'],
  'add-student': ['Add Student',     'JIMS › Student Profile › Add Student'],
};

let currentPage     = '';
let currentUserRole = 'student';

function navigate(page, opts = {}) {
  if (!PAGES.includes(page)) return;
  if (page === 'add-student' && currentUserRole !== 'admin') {
    alert('Only administrators can add or edit students.');
    return;
  }

  PAGES.forEach(p => {
    const el = document.getElementById('page-' + p);
    if (el) el.style.display = 'none';
  });

  const target = document.getElementById('page-' + page);
  if (target) target.style.display = '';

  const [title, breadcrumb] = PAGE_TITLES[page] || [page, 'JIMS › ' + page];
  const titleEl = document.getElementById('topbarTitle');
  const crumbEl = document.getElementById('topbarBreadcrumb');
  if (titleEl) titleEl.textContent = title;
  if (crumbEl) crumbEl.textContent = breadcrumb;

  document.querySelectorAll('.nav-link').forEach(a => {
    a.classList.toggle('active', a.dataset.page === page);
  });

  currentPage = page;

  if (page === 'dashboard')   initDashboard();
  if (page === 'home')        initHome();
  if (page === 'profiles')    renderStudentTable();
  if (page === 'add-student') {
    if (!opts.edit) resetStudentForm();
    initStudentForm();
  }
  if (page === 'attendance') initAttendancePage();
}

/* ────────────────────────────────────────────────────────────────
   SECTION 2 — LOGIN
   ──────────────────────────────────────────────────────────────── */

function generateCaptcha() {
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  const box  = document.getElementById('captcha');
  if (box) box.value = code;
  localStorage.setItem('captcha', code);
}

/* ── OTP System ── */
let _otpValue = '';
let _otpTimer = null;

function generateOTP() {
  const slot = Math.floor(Date.now() / 30000);
  let n = slot;
  n = ((n >> 16) ^ n) * 0x45d9f3b;
  n = ((n >> 16) ^ n) * 0x45d9f3b;
  n = (n >> 16) ^ n;
  _otpValue = String(Math.abs(n) % 1000000).padStart(6, '0');
  return _otpValue;
}

function startOTPClock() {
  if (!document.getElementById('otpDisplay')) return;
  function tick() {
    const now         = Date.now();
    const msInSlot    = now % 30000;
    const secondsLeft = Math.ceil((30000 - msInSlot) / 1000);
    const slotOtp     = generateOTP();
    const displayEl   = document.getElementById('otpDisplay');
    const arcEl       = document.getElementById('otpTimerArc');
    const countEl     = document.getElementById('otpTimerCount');
    if (displayEl) displayEl.textContent = slotOtp;
    const pct = ((30000 - msInSlot) / 30000) * 100;
    if (arcEl)   arcEl.setAttribute('stroke-dasharray', `${pct.toFixed(1)} 100`);
    if (countEl) countEl.textContent = secondsLeft + 's';
    const color = secondsLeft <= 5 ? '#f59e0b' : '#22c55e';
    if (arcEl)     arcEl.setAttribute('stroke', color);
    if (displayEl) displayEl.style.color = color;
  }
  tick();
  _otpTimer = setInterval(tick, 500);
}

function stopOTPClock() {
  if (_otpTimer) { clearInterval(_otpTimer); _otpTimer = null; }
}

function togglePasswordSection() {
  const role    = document.getElementById('user-type')?.value || 'student';
  const section = document.getElementById('passwordSection');
  const isAdmin = (role === 'admin');
  if (!section) return;
  if (isAdmin) { section.style.display = ''; }
  else         { section.style.display = 'none'; }
}

function toggleOTPSection() {
  const role     = document.getElementById('user-type')?.value || 'student';
  const section  = document.getElementById('otpSection');
  const needsOtp = (role === 'student' || role === 'teacher');
  if (!section) return;
  if (needsOtp) { section.style.display = ''; startOTPClock(); }
  else          { section.style.display = 'none'; stopOTPClock(); }
}

function validateLogin() {
  const role   = document.getElementById('user-type')?.value || 'student';
  const user   = document.getElementById('username')?.value?.trim();
  const pass   = document.getElementById('password')?.value;
  const input  = document.getElementById('captcha-input')?.value?.trim()?.toUpperCase();
  const stored = localStorage.getItem('captcha');

  if (!user || !input) { alert('Please fill all fields'); return; }
  if (role === 'admin' && !pass) { alert('Please enter password'); return; }
  if (role === 'admin' && pass !== 'jacsiceeceiii') { alert('Invalid Admin Password'); return; }
  if (stored && input !== stored) { alert('Invalid CAPTCHA'); return; }

  if (role === 'student' || role === 'teacher') {
    const otpEntered = document.getElementById('otp-input')?.value?.trim();
    if (!otpEntered) { alert('Please enter the OTP from Admin Portal'); return; }
    const currentOtp = generateOTP();
    if (otpEntered !== currentOtp) {
      alert('Invalid OTP. Get the current code from the Admin Portal and try again.');
      document.getElementById('otp-input').value = '';
      return;
    }
  }

  const nameEl    = document.getElementById('loggedUserName');
  const roleEl    = document.getElementById('loggedUserRole');
  const roleLabel = { admin: 'Administrator', teacher: 'Teacher', student: 'Student' };
  if (nameEl) nameEl.textContent = user;
  if (roleEl) roleEl.textContent = roleLabel[role] || role;

  currentUserRole = role;

  const addStudentNav = document.querySelector('.nav-link[data-page="add-student"]');
  if (addStudentNav) {
    addStudentNav.closest('li').style.display = role === 'admin' ? '' : 'none';
  }

  document.getElementById('page-login').classList.remove('active');
  document.getElementById('page-login').style.display = 'none';
  document.getElementById('app-shell').style.display  = 'flex';

  if (role === 'admin')        navigate('dashboard');
  else if (role === 'teacher') navigate('attendance');
  else                         navigate('home');
}

function doLogout() {
  stopOTPClock();
  stopPortalOTPClock();
  document.getElementById('app-shell').style.display = 'none';
  const login = document.getElementById('page-login');
  login.style.display = '';
  login.classList.add('active');
  document.getElementById('username').value      = '';
  document.getElementById('password').value      = '';
  document.getElementById('captcha-input').value = '';
  const otpInput = document.getElementById('otp-input');
  if (otpInput) otpInput.value = '';
  const portalOverlay = document.getElementById('adminPortalOverlay');
  if (portalOverlay) portalOverlay.style.display = 'none';
  const viewOverlay = document.getElementById('viewStudentOverlay');
  if (viewOverlay) viewOverlay.style.display = 'none';
  currentUserRole     = 'student';
  profilesInitialized = false;
  _cachedStudents     = null;
  _cachedAttendance   = null;
  generateCaptcha();
}

/* ── Admin Portal ── */
function showAdminPortalPrompt() {
  const box = document.getElementById('adminPortalBox');
  if (box) {
    box.style.display = box.style.display === 'none' ? '' : 'none';
    const err = document.getElementById('adminPortalError');
    if (err) err.style.display = 'none';
    const inp = document.getElementById('adminPortalPassword');
    if (inp) { inp.value = ''; inp.focus(); }
  }
}

function verifyAdminPortal() {
  const inp = document.getElementById('adminPortalPassword');
  const err = document.getElementById('adminPortalError');
  if (!inp) return;
  if (inp.value === 'jacsiceeceiii') {
    document.getElementById('adminPortalBox').style.display = 'none';
    inp.value = '';
    const overlay = document.getElementById('adminPortalOverlay');
    if (overlay) {
      // Fetch live student count from Firestore
      db.collection(STUDENTS_COL).get().then(snap => {
        const countEl = document.getElementById('portalStudentCount');
        if (countEl) countEl.textContent = snap.size;
      }).catch(() => {});
      overlay.style.display = '';
      startPortalOTPClock();
    }
  } else {
    if (err) err.style.display = '';
    inp.value = '';
    inp.focus();
  }
}

/* ── Portal OTP Clock ── */
let _portalOtpTimer = null;

function startPortalOTPClock() {
  const displayEl = document.getElementById('portalOtpDisplay');
  const arcEl     = document.getElementById('portalOtpArc');
  const countEl   = document.getElementById('portalOtpCount');
  if (!displayEl) return;
  const CIRCUMFERENCE = 2 * Math.PI * 18;
  function tick() {
    const now      = Date.now();
    const msInSlot = now % 30000;
    const secsLeft = Math.ceil((30000 - msInSlot) / 1000);
    const otp      = generateOTP();
    displayEl.textContent = otp;
    const dash = ((30000 - msInSlot) / 30000 * CIRCUMFERENCE).toFixed(1);
    if (arcEl)   arcEl.setAttribute('stroke-dasharray', `${dash} ${CIRCUMFERENCE}`);
    if (countEl) countEl.textContent = secsLeft + 's';
    const color = secsLeft <= 5 ? '#f59e0b' : '#22c55e';
    if (arcEl)     arcEl.setAttribute('stroke', color);
    if (displayEl) displayEl.style.color = color;
  }
  tick();
  _portalOtpTimer = setInterval(tick, 500);
}

function stopPortalOTPClock() {
  if (_portalOtpTimer) { clearInterval(_portalOtpTimer); _portalOtpTimer = null; }
}

/* ────────────────────────────────────────────────────────────────
   SECTION 3 — SIDEBAR & DARK MODE
   ──────────────────────────────────────────────────────────────── */

function initSidebar() {
  const menuBtn = document.getElementById('menuBtn');
  if (menuBtn) {
    menuBtn.addEventListener('click', () => {
      document.body.classList.toggle('collapsed');
      const icon = menuBtn.querySelector('i');
      if (icon) icon.className = document.body.classList.contains('collapsed')
        ? 'fa fa-chevron-right'
        : 'fa fa-chevron-left';
    });
  }
  document.querySelectorAll('.nav-link').forEach(a => {
    a.addEventListener('click', e => { e.preventDefault(); navigate(a.dataset.page); });
  });
}

function initDarkMode() {
  const btn    = document.getElementById('toggleModeBtn');
  if (!btn) return;
  const icon   = btn.querySelector('i');
  const stored = localStorage.getItem('darkMode');
  if (stored === 'on') { document.body.classList.add('dark-mode'); if (icon) icon.className = 'fa fa-sun'; }
  btn.addEventListener('click', () => {
    const on = document.body.classList.toggle('dark-mode');
    if (icon) icon.className = on ? 'fa fa-sun' : 'fa fa-moon';
    localStorage.setItem('darkMode', on ? 'on' : 'off');
  });
}

function initTopbarSearch() {
  const el = document.getElementById('topbarSearch');
  if (!el) return;
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter' && el.value.trim()) {
      navigate('profiles');
      setTimeout(() => {
        const si = document.getElementById('searchInput');
        if (si) { si.value = el.value.trim(); filterStudents(); }
      }, 100);
    }
  });
}

/* ────────────────────────────────────────────────────────────────
   SECTION 4 — FIREBASE DATA HELPERS
   ──────────────────────────────────────────────────────────────── */

let _cachedStudents   = null;
let _cachedAttendance = null;

/* Loading overlay */
function showLoader(msg) {
  let el = document.getElementById('jimsLoader');
  if (!el) {
    el = document.createElement('div');
    el.id = 'jimsLoader';
    el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;';
    el.innerHTML = `
      <div style="width:46px;height:46px;border:4px solid rgba(255,255,255,0.2);border-top-color:#22c55e;border-radius:50%;animation:jimspin 0.8s linear infinite;"></div>
      <p id="jimsLoaderMsg" style="color:#fff;font-size:0.95rem;font-family:sans-serif;">${msg||'Loading…'}</p>`;
    if (!document.getElementById('jimsSpinStyle')) {
      const s = document.createElement('style');
      s.id = 'jimsSpinStyle';
      s.textContent = '@keyframes jimspin{to{transform:rotate(360deg)}}';
      document.head.appendChild(s);
    }
    document.body.appendChild(el);
  } else {
    const m = document.getElementById('jimsLoaderMsg');
    if (m) m.textContent = msg || 'Loading…';
    el.style.display = 'flex';
  }
}
function hideLoader() {
  const el = document.getElementById('jimsLoader');
  if (el) el.style.display = 'none';
}

/* ── STUDENTS (Firestore) ── */
async function getStudents() {
  if (_cachedStudents) return _cachedStudents;
  try {
    const snap = await db.collection(STUDENTS_COL).orderBy('createdAt', 'asc').get();
    _cachedStudents = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
    return _cachedStudents;
  } catch (e) {
    console.error('getStudents error', e);
    return [];
  }
}

async function saveStudent(studentData, firestoreId) {
  // Strip internal _id before writing
  const { _id, ...payload } = studentData;
  payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
  if (firestoreId) {
    await db.collection(STUDENTS_COL).doc(firestoreId).update(payload);
  } else {
    payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    await db.collection(STUDENTS_COL).add(payload);
  }
  _cachedStudents = null;
}

async function deleteStudentById(firestoreId) {
  await db.collection(STUDENTS_COL).doc(firestoreId).delete();
  _cachedStudents = null;
}

async function clearAllStudents() {
  const snap  = await db.collection(STUDENTS_COL).get();
  const batch = db.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  _cachedStudents = null;
}

/* ── ATTENDANCE (Firestore) ── */
async function getAttendanceHistory() {
  if (_cachedAttendance) return _cachedAttendance;
  try {
    const snap = await db.collection(ATTENDANCE_COL).orderBy('date', 'asc').get();
    _cachedAttendance = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
    return _cachedAttendance;
  } catch (e) {
    console.error('getAttendanceHistory error', e);
    return [];
  }
}

async function saveAttendanceRecords(records) {
  const batch = db.batch();
  records.forEach(rec => {
    const ref = db.collection(ATTENDANCE_COL).doc();
    batch.set(ref, { ...rec, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  });
  await batch.commit();
  _cachedAttendance = null;
}

/* ── MISC UTILS ── */
function txt(v)  { return (v == null || v === '') ? 'N/A' : String(v); }
function safe(v) {
  if (v == null) return '';
  const s = String(v).replace(/"/g, '""');
  return s.includes(',') || s.includes('\n') ? `"${s}"` : s;
}
function escapeHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ────────────────────────────────────────────────────────────────
   SECTION 5 — HOME PAGE
   ──────────────────────────────────────────────────────────────── */

async function initHome() {
  showLoader('Loading…');
  const [students, hist] = await Promise.all([getStudents(), getAttendanceHistory()]);
  hideLoader();

  const statStudents = document.getElementById('homeStatStudents');
  const statScholar  = document.getElementById('homeStatScholar');
  const statAtt      = document.getElementById('homeStatAttendance');

  const scholarKeys  = ['firstGraduate','pmss','mbcBc','dncBcmDnt','scholarship75','pudhumaiPenn','tamilPulhalwan','centralScholarship'];
  const scholarCount = students.filter(s => scholarKeys.some(k => String(s[k]||'').toLowerCase() === 'yes')).length;

  if (statStudents) statStudents.textContent = students.length;
  if (statScholar)  statScholar.textContent  = scholarCount;

  if (statAtt && hist.length) {
    const total   = hist.length;
    const present = hist.filter(r => r.status === 'present').length
                  + hist.filter(r => r.status === 'halfday').length * 0.5;
    statAtt.textContent = Math.round((present / total) * 100) + '%';
  } else if (statAtt) {
    statAtt.textContent = '—';
  }
}

/* ────────────────────────────────────────────────────────────────
   SECTION 6 — DASHBOARD
   ──────────────────────────────────────────────────────────────── */

async function initDashboard() {
  showLoader('Loading dashboard…');
  const students = await getStudents();
  hideLoader();

  const total       = students.length;
  const scholarKeys = ['firstGraduate','pmss','mbcBc','dncBcmDnt','scholarship75','pudhumaiPenn','tamilPulhalwan','centralScholarship'];
  const scholar     = students.filter(s => scholarKeys.some(k => String(s[k]||'').toLowerCase() === 'yes')).length;

  const deptCounts = {}, batchCounts = {};
  students.forEach(s => {
    const dep   = (s.ugDepartment||s.pgDepartment||s.department||'').trim()||'Unassigned';
    const batch = (s.ugBatch||s.pgBatch||s.batch||s.Batch||'').trim()||'Unassigned';
    deptCounts[dep]    = (deptCounts[dep]    || 0) + 1;
    batchCounts[batch] = (batchCounts[batch] || 0) + 1;
  });

  const deptEntries  = Object.entries(deptCounts).sort((a,b)  => b[1]-a[1]);
  const batchEntries = Object.entries(batchCounts).sort((a,b) => b[1]-a[1]);

  animateCount(document.getElementById('kpi-total'),       total);
  animateCount(document.getElementById('kpi-scholar'),     scholar);
  animateCount(document.getElementById('kpi-departments'), deptEntries.length);
  animateCount(document.getElementById('kpi-batches'),     batchEntries.length);

  const kpiTotalDelta   = document.getElementById('kpi-total-delta');
  const kpiScholarDelta = document.getElementById('kpi-scholar-delta');
  const deptTag         = document.getElementById('dept-count-tag');
  const batchTag        = document.getElementById('batch-count-tag');
  if (kpiTotalDelta)   kpiTotalDelta.textContent   = total ? `${scholar} with scholarship` : 'No students yet';
  if (kpiScholarDelta) kpiScholarDelta.textContent  = total ? `${((scholar/total)*100).toFixed(1)}% of total` : '—';
  if (deptTag)         deptTag.textContent  = `${deptEntries.length} dept${deptEntries.length !== 1 ? 's' : ''}`;
  if (batchTag)        batchTag.textContent = `${batchEntries.length} batch${batchEntries.length !== 1 ? 'es' : ''}`;

  renderBreakup('dept-breakup',  deptEntries, '');
  renderBreakup('batch-breakup', batchEntries, 'blue');

  const recent = [...students].reverse().slice(0, 8);
  const wrap   = document.getElementById('recent-table-wrap');
  if (wrap) {
    if (!recent.length) {
      wrap.innerHTML = '<p style="color:var(--text-secondary);padding:16px;">No students yet. <a href="#" onclick="navigate(\'add-student\');return false;" style="color:var(--accent);">Add one →</a></p>';
      return;
    }
    const scholarLabel = s => scholarKeys.some(k => String(s[k]||'').toLowerCase() === 'yes')
      ? '<span class="status-pill yes">Active</span>'
      : '<span class="status-pill no">None</span>';
    wrap.innerHTML = `
      <table class="data-table">
        <thead><tr><th>#</th><th>Student Name</th><th>Register No.</th><th>Batch</th><th>Mobile</th><th>Scholarship</th></tr></thead>
        <tbody>
          ${recent.map((s,i) => `
            <tr>
              <td>${i+1}</td>
              <td class="td-name">${escapeHtml(s.name||s.studentName)}</td>
              <td style="font-family:'DM Mono',monospace;font-size:0.8rem">${escapeHtml(s.registerNumber)}</td>
              <td>${escapeHtml(s.ugBatch||s.pgBatch||s.batch||s.Batch)}</td>
              <td>${escapeHtml(s.mobileNumber)}</td>
              <td>${scholarLabel(s)}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  }
}

function animateCount(el, target) {
  if (!el || typeof target !== 'number') return;
  if (target === 0) { el.textContent = '0'; return; }
  const steps = 45, duration = 900;
  let cur = 0;
  const inc = target / steps;
  const iv = setInterval(() => {
    cur = Math.min(cur + inc, target);
    el.textContent = Math.round(cur);
    if (cur >= target) clearInterval(iv);
  }, duration / steps);
}

function renderBreakup(containerId, entries, colorClass) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!entries.length) { el.innerHTML = '<p style="color:var(--text-muted);font-size:0.82rem;padding:8px 0">No data yet</p>'; return; }
  const max = entries[0][1];
  el.innerHTML = '';
  entries.forEach(([label, count]) => {
    const pct = Math.max(4, Math.round((count / max) * 100));
    const div = document.createElement('div');
    div.className = 'breakup-item';
    div.innerHTML = `
      <span class="bi-label" title="${escapeHtml(label)}">${escapeHtml(label)}</span>
      <div class="breakup-bar-wrap"><div class="breakup-bar ${colorClass}" style="width:0%" data-target="${pct}"></div></div>
      <span class="bi-count">${count}</span>`;
    el.appendChild(div);
  });
  requestAnimationFrame(() => {
    el.querySelectorAll('.breakup-bar').forEach(bar => {
      setTimeout(() => { bar.style.width = bar.dataset.target + '%'; }, 80);
    });
  });
}

/* ────────────────────────────────────────────────────────────────
   SECTION 7 — ATTENDANCE
   ──────────────────────────────────────────────────────────────── */

async function initAttendancePage() {
  const dateEl     = document.getElementById('currentDate');
  const histDateEl = document.getElementById('historyDate');
  if (dateEl)     dateEl.textContent = new Date().toLocaleDateString();
  if (histDateEl && !histDateEl.value) histDateEl.valueAsDate = new Date();
  await updateQuickStats();
  showAttSection('homeSection');
}

function showAttSection(id) {
  ['homeSection','attendanceSection','reportsSection','historySection'].forEach(s => {
    const el = document.getElementById(s);
    if (el) el.style.display = s === id ? '' : 'none';
  });
  document.querySelectorAll('.att-nav-btn').forEach((btn, i) => {
    const map = ['homeSection','attendanceSection','reportsSection','historySection'];
    btn.classList.toggle('active', map[i] === id);
  });
  if (id === 'reportsSection') generateReport();
  if (id === 'historySection') loadAttendanceHistory();
  if (id === 'attendanceSection') {
    const tbody = document.getElementById('attendanceTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;color:#888">Select batch to load students</td></tr>';
  }
}

async function updateQuickStats() {
  const [students, history] = await Promise.all([getStudents(), getAttendanceHistory()]);
  const stats = {};
  history.forEach(rec => {
    if (!rec.registerNumber) return;
    const key = rec.registerNumber;
    if (!stats[key]) stats[key] = { score: 0, total: 0, name: rec.studentName || '' };
    stats[key].score += rec.status === 'present' ? 1 : rec.status === 'halfday' ? 0.5 : 0;
    stats[key].total += 1;
  });
  const studentsByReg = {};
  students.forEach(s => { if (s.registerNumber) studentsByReg[s.registerNumber] = s.name || s.studentName || ''; });
  const critical = [];
  Object.keys(stats).forEach(reg => {
    const e   = stats[reg];
    const pct = e.total ? Math.round((e.score / e.total) * 100) : 0;
    if (pct < 80) critical.push({ reg, name: e.name || studentsByReg[reg] || reg, percent: pct });
  });
  const listEl  = document.getElementById('criticalList');
  const countEl = document.getElementById('criticalCount');
  if (!listEl || !countEl) return;
  if (critical.length === 0) {
    listEl.innerHTML    = '<li>No critical students</li>';
    countEl.textContent = '0';
  } else {
    countEl.textContent = String(critical.length);
    listEl.innerHTML    = '';
    critical.sort((a,b) => a.percent - b.percent).forEach(c => {
      const li = document.createElement('li');
      li.textContent = `${c.name} (${c.reg}) — ${c.percent}%`;
      listEl.appendChild(li);
    });
  }
}

async function loadStudents() {
  const batch = document.getElementById('filterBatch')?.value;
  if (!batch) { alert('Please select a batch first'); return; }
  showLoader('Loading students…');
  const all = await getStudents();
  hideLoader();
  const students = all.filter(s => {
    return (s.ugDepartment === 'ECE' && s.ugBatch === batch)
      || (s.pgDepartment  === 'ECE' && s.pgBatch  === batch)
      || (s.department    === 'ECE' && (s.batch === batch || s.ugBatch === batch))
      || s.Batch === batch;
  });
  const tbody = document.getElementById('attendanceTableBody');
  if (!tbody) return;
  if (!students.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;color:#888">No students found for selected batch</td></tr>';
    return;
  }
  tbody.innerHTML = '';
  students.forEach((s, i) => {
    const reg = s.registerNumber || 'N/A';
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${i+1}</td>
      <td>${escapeHtml(reg)}</td>
      <td>${escapeHtml(s.name||s.studentName||'N/A')}</td>
      <td>ECE</td>
      <td><input type="radio" name="att-${reg}" value="present" checked></td>
      <td><input type="radio" name="att-${reg}" value="halfday"></td>
      <td><input type="radio" name="att-${reg}" value="absent"></td>
      <td><input type="text" class="rem-input" data-reg="${escapeHtml(reg)}" placeholder="Remarks"
          style="border:1px solid var(--border);border-radius:6px;padding:5px 8px;font-size:0.82rem;width:100%;background:var(--surface);color:var(--text-primary);"></td>`;
    tbody.appendChild(row);
  });
  tbody.querySelectorAll('input[type="radio"]').forEach(r => {
    r.addEventListener('change', function() { updateRowStatus(this); });
  });
}

function updateRowStatus(radio) {
  const row = radio.closest('tr');
  if (!row) return;
  row.className = '';
  if (radio.value === 'present') row.classList.add('status-present');
  if (radio.value === 'halfday') row.classList.add('status-halfday');
  if (radio.value === 'absent')  row.classList.add('status-absent');
}

function markAllPresent() {
  document.querySelectorAll('#attendanceTableBody input[value="present"]').forEach(r => { r.checked = true; updateRowStatus(r); });
}
function markAllAbsent() {
  document.querySelectorAll('#attendanceTableBody input[value="absent"]').forEach(r => { r.checked = true; updateRowStatus(r); });
}

async function saveAttendance() {
  const batch = document.getElementById('filterBatch')?.value;
  if (!batch) { alert('Please select a batch before saving'); return; }
  const date  = new Date().toISOString().split('T')[0];
  const tbody = document.getElementById('attendanceTableBody');
  if (!tbody) return;
  const records = [];
  tbody.querySelectorAll('tr').forEach(row => {
    const cells = row.children;
    if (!cells[1]) return;
    const reg = cells[1].textContent.trim();
    if (!reg || reg === 'N/A') return;
    const radio   = row.querySelector(`input[name="att-${reg}"]:checked`);
    const remarks = row.querySelector('.rem-input');
    if (radio) {
      records.push({ date, registerNumber: reg, studentName: cells[2]?.textContent?.trim()||'', department: 'ECE', batch, status: radio.value, remarks: remarks?.value||'' });
    }
  });
  showLoader('Saving attendance to Firebase…');
  try {
    await saveAttendanceRecords(records);
    hideLoader();
    alert(`✅ Attendance saved for ${records.length} students!`);
    await updateQuickStats();
  } catch (e) {
    hideLoader();
    alert('❌ Error saving attendance: ' + e.message);
  }
}

async function generateReport() {
  const threshold = parseInt(document.getElementById('reportThreshold')?.value || '80');
  const batch     = document.getElementById('reportBatch')?.value || '';
  const tbody     = document.getElementById('reportTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  showLoader('Generating report…');
  const [students, history] = await Promise.all([getStudents(), getAttendanceHistory()]);
  hideLoader();
  let found = 0;
  students.forEach(s => {
    const isEce      = s.ugDepartment === 'ECE' || s.pgDepartment === 'ECE' || s.department === 'ECE';
    const batchMatch = !batch || s.ugBatch === batch || s.pgBatch === batch || s.batch === batch || s.Batch === batch;
    if (!isEce || !batchMatch) return;
    const hist = history.filter(h => h.registerNumber === s.registerNumber);
    let pct;
    if (hist.length) {
      const score = hist.reduce((acc, h) => acc + (h.status === 'present' ? 1 : h.status === 'halfday' ? 0.5 : 0), 0);
      pct = Math.round((score / hist.length) * 100);
    } else {
      pct = Math.floor(Math.random() * 30) + 60;
    }
    if (pct < threshold) {
      found++;
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${escapeHtml(s.registerNumber)}</td>
        <td>${escapeHtml(s.name||s.studentName)}</td>
        <td>ECE</td>
        <td>${escapeHtml(s.ugBatch||s.pgBatch||s.batch||s.Batch)}</td>
        <td><strong style="color:${pct < 65 ? 'var(--rose)' : 'var(--amber)'}">${pct}%</strong></td>
        <td><span class="status-pill" style="background:${pct < 65 ? 'var(--rose-soft)' : 'var(--amber-soft)'};color:${pct < 65 ? 'var(--rose)' : 'var(--amber)'}">${pct < 65 ? 'Critical' : 'Warning'}</span></td>`;
      tbody.appendChild(row);
    }
  });
  if (!found) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#888">No students below the threshold</td></tr>';
}

async function loadAttendanceHistory() {
  const date  = document.getElementById('historyDate')?.value || '';
  const batch = document.getElementById('historyBatch')?.value || '';
  const tbody = document.getElementById('historyTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#888"><i class="fa fa-spinner fa-spin"></i> Loading from Firebase…</td></tr>';
  const history  = await getAttendanceHistory();
  tbody.innerHTML = '';
  const filtered = history.filter(r => (!date || r.date === date) && (!batch || r.batch === batch));
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#888">No attendance records found</td></tr>';
    return;
  }
  filtered.forEach(r => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${r.date}</td><td>${escapeHtml(r.registerNumber)}</td><td>${escapeHtml(r.studentName)}</td><td>${escapeHtml(r.department)}</td><td>${r.status}</td><td>${escapeHtml(r.remarks)}</td>`;
    tbody.appendChild(row);
  });
}

function exportToExcel() {
  if (typeof XLSX === 'undefined') { alert('XLSX library not loaded'); return; }
  const table = document.getElementById('attendanceTable');
  if (!table) return;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.table_to_sheet(table), 'Attendance');
  const batch = document.getElementById('filterBatch')?.value || 'All';
  XLSX.writeFile(wb, `Attendance_ECE_${batch}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

function exportReportToExcel() {
  if (typeof XLSX === 'undefined') { alert('XLSX library not loaded'); return; }
  const table = document.getElementById('reportTable');
  if (!table) return;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.table_to_sheet(table), 'Report');
  XLSX.writeFile(wb, `Attendance_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
}

function sendAlerts() {
  alert('Alert notifications would be sent to students with low attendance in a real implementation.');
}

/* ────────────────────────────────────────────────────────────────
   SECTION 8 — STUDENT PROFILES
   ──────────────────────────────────────────────────────────────── */

const scholarTokenMap = {
  fg_yes: { key: 'firstGraduate', val: 'yes' }, fg_no: { key: 'firstGraduate', val: 'no' },
  pmss_yes: { key: 'pmss', val: 'yes' }, pmss_no: { key: 'pmss', val: 'no' },
  bcmbc_yes: { key: 'mbcBc', val: 'yes' }, bcmbc_no: { key: 'mbcBc', val: 'no' },
  dncbcm_yes: { key: 'dncBcmDnt', val: 'yes' }, dncbcm_no: { key: 'dncBcmDnt', val: 'no' },
  sevenfive_yes: { key: 'scholarship75', val: 'yes' }, sevenfive_no: { key: 'scholarship75', val: 'no' },
  pudhumai_yes: { key: 'pudhumaiPenn', val: 'yes' }, pudhumai_no: { key: 'pudhumaiPenn', val: 'no' },
  tamilpulhalwan_yes: { key: 'tamilPulhalwan', val: 'yes' }, tamilpulhalwan_no: { key: 'tamilPulhalwan', val: 'no' },
  central_yes: { key: 'centralScholarship', val: 'yes' }, central_no: { key: 'centralScholarship', val: 'no' },
  name: { key: 'name', val: null }, aadhaar: { key: 'aadhaarNumber', val: null },
  email: { key: 'studentEmail', val: null }, mobile: { key: 'mobileNumber', val: null },
  gender: { key: 'gender', val: null }, caste: { key: 'caste', val: null },
  religion: { key: 'religion', val: null }, bankName: { key: 'bankName', val: null },
  accountNumber: { key: 'accountNumber', val: null }, ifsc: { key: 'ifsc', val: null },
  micr: { key: 'micr', val: null }, fatherName: { key: 'fatherName', val: null },
  motherName: { key: 'motherName', val: null }, fatherDOB: { key: 'fatherDOB', val: null },
  parentContact: { key: 'parentsContactNumber', val: null }
};

let lastFiltered       = [];
let profilesInitialized = false;

function initProfileFilters() {
  const toggleBtn = document.getElementById('filterToggleBtn');
  const container = document.getElementById('filtersContainer');
  if (toggleBtn && container) {
    toggleBtn.addEventListener('click', () => {
      container.style.display = (container.style.display === 'none' || container.style.display === '') ? '' : 'none';
    });
  }
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      if (!target) return;
      target.style.display = target.style.display !== 'none' ? 'none' : '';
    });
  });
  const addBtn = document.getElementById('addStudentBtn');
  if (addBtn) {
    addBtn.style.display = currentUserRole === 'admin' ? '' : 'none';
    addBtn.addEventListener('click', () => navigate('add-student'));
  }
  const downloadBtn = document.getElementById('downloadReport');
  if (downloadBtn) downloadBtn.addEventListener('click', e => { e.preventDefault(); exportFilteredStudentsCSV(lastFiltered); });
  const applyBtn  = document.getElementById('applyBtn');
  if (applyBtn)   applyBtn.addEventListener('click', filterStudents);
  const clearBtn  = document.getElementById('clearFiltersBtn');
  if (clearBtn)   clearBtn.addEventListener('click', () => {
    document.querySelectorAll('.filter-options input[type="checkbox"]').forEach(cb => (cb.checked = false));
    const si = document.getElementById('searchInput');
    if (si) si.value = '';
    filterStudents();
  });
  const si = document.getElementById('searchInput');
  if (si) si.addEventListener('input', filterStudents);
}

async function renderStudentTable(studentsArg) {
  if (!profilesInitialized) { initProfileFilters(); profilesInitialized = true; }
  const tbody = document.getElementById('studentTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:#888"><i class="fa fa-spinner fa-spin"></i> Loading from Firebase…</td></tr>';

  const students = studentsArg !== undefined ? studentsArg : await getStudents();
  lastFiltered   = students.slice();

  if (!students.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:#888">No students found. <a href="#" onclick="navigate(\'add-student\');return false;" style="color:var(--accent);">Add a student →</a></td></tr>';
    return;
  }

  const scholarKeys = ['firstGraduate','pmss','mbcBc','dncBcmDnt','scholarship75','pudhumaiPenn','tamilPulhalwan','centralScholarship'];
  tbody.innerHTML   = '';
  students.forEach((s, i) => {
    const hasScholar = scholarKeys.some(k => String(s[k]||'').toLowerCase() === 'yes');
    const photoHtml  = s.photo
      ? `<div class="student-thumb"><img src="${s.photo}" alt="photo"></div>`
      : `<div class="student-thumb" style="background:var(--accent-soft);color:var(--accent);display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;font-weight:700;font-size:0.8rem">${(s.name||s.studentName||'?')[0].toUpperCase()}</div>`;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${i+1}</td>
      <td>${photoHtml}</td>
      <td class="td-name">${escapeHtml(s.name||s.studentName||'—')}</td>
      <td style="font-family:'DM Mono',monospace;font-size:0.8rem">${escapeHtml(s.registerNumber)}</td>
      <td>${escapeHtml(s.ugBatch||s.pgBatch||s.batch||s.Batch)}</td>
      <td>${escapeHtml(s.mobileNumber)}</td>
      <td><span class="status-pill ${hasScholar ? 'yes' : 'no'}">${hasScholar ? 'Active' : 'None'}</span></td>
      <td class="action-cell">
        <button class="act-btn view-btn" onclick="viewStudent(${i})" title="View"><i class="fa fa-eye"></i></button>
        ${currentUserRole === 'admin' ? `
          <button class="act-btn" onclick="editStudent(${i})" title="Edit"><i class="fa fa-pen"></i></button>
          <button class="act-btn danger" onclick="deleteStudent(${i})" title="Delete"><i class="fa fa-trash"></i></button>` : ''}
      </td>`;
    tbody.appendChild(row);
  });
}

async function filterStudents() {
  const query   = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
  const checked = [...document.querySelectorAll('.filter-options input[type="checkbox"]:checked')].map(cb => cb.value);
  let students  = await getStudents();
  if (query) {
    students = students.filter(s => {
      return (s.name||s.studentName||'').toLowerCase().includes(query)
          || (s.registerNumber||'').toLowerCase().includes(query)
          || (s.studentEmail||'').toLowerCase().includes(query);
    });
  }
  if (checked.length) {
    students = students.filter(s => checked.every(token => {
      const map = scholarTokenMap[token];
      if (!map) return true;
      if (map.val) return String(s[map.key]||'').toLowerCase() === map.val;
      return !!(s[map.key]);
    }));
  }
  lastFiltered = students.slice();
  renderStudentTable(students);
}

async function editStudent(tableIdx) {
  if (currentUserRole !== 'admin') { alert('Only administrators can edit student records.'); return; }
  const students = await getStudents();
  const s        = students[tableIdx];
  if (!s) return;
  navigate('add-student', { edit: true });
  setTimeout(() => {
    document.getElementById('studentId').value = tableIdx;
    const fbId = document.getElementById('studentFirebaseId');
    if (fbId) fbId.value = s._id || '';
    populateFormFromStudent(s);
    initStudentForm();
  }, 50);
}

async function deleteStudent(tableIdx) {
  if (currentUserRole !== 'admin') { alert('Only administrators can delete student records.'); return; }
  if (!confirm('Delete this student? This cannot be undone.')) return;
  const students = await getStudents();
  const s        = students[tableIdx];
  if (!s || !s._id) return;
  showLoader('Deleting student from Firebase…');
  try {
    await deleteStudentById(s._id);
    hideLoader();
    renderStudentTable();
  } catch (e) {
    hideLoader();
    alert('❌ Error deleting student: ' + e.message);
  }
}

async function viewStudent(tableIdx) {
  const students = await getStudents();
  const s        = students[tableIdx];
  if (!s) return;
  const overlay  = document.getElementById('viewStudentOverlay');
  const content  = document.getElementById('viewStudentContent');
  const editBtn  = document.getElementById('viewEditBtn');
  if (!overlay || !content) return;
  if (editBtn) {
    editBtn.style.display  = currentUserRole === 'admin' ? '' : 'none';
    window.editFromView    = () => { overlay.style.display = 'none'; editStudent(tableIdx); };
  }
  window.currentViewRole = currentUserRole;
  const T   = v => (v == null || v === '') ? 'N/A' : String(v);
  const row = (label, val) => `<div class="vp-row"><span class="vp-label">${label}</span><span class="vp-val">${escapeHtml(T(val))}</span></div>`;
  const photoHtml = s.photo
    ? `<img src="${s.photo}" alt="Photo" style="width:100px;height:130px;object-fit:cover;border-radius:8px;border:2px solid #e2e8f0;float:right;">`
    : '';
  content.innerHTML = `
    <div style="overflow:hidden;margin-bottom:20px;">
      ${photoHtml}
      <h2 style="color:#22c55e;font-size:1.6rem;margin-bottom:4px;font-weight:800;">${escapeHtml(T(s.name||s.studentName))}</h2>
      <p style="color:#64748b;font-size:0.9rem;">Register No: <strong>${escapeHtml(T(s.registerNumber))}</strong> &nbsp;|&nbsp; Batch: <strong>${escapeHtml(T(s.Batch||s.ugBatch))}</strong> &nbsp;|&nbsp; Dept: <strong>${escapeHtml(T(s.department||'ECE'))}</strong></p>
    </div>
    <div class="vp-section"><div class="vp-section-title"><i class="fa fa-user"></i> Personal Information</div><div class="vp-grid">
      ${row('Student Name',s.name||s.studentName)}${row('Register Number',s.registerNumber)}
      ${row('Date of Birth',s.dateOfBirth)}${row('Aadhaar Number',s.aadhaarNumber)}
      ${row('Email ID',s.studentEmail)}${row('Mobile Number',s.mobileNumber)}
      ${row('Blood Group',s.bloodGroup)}${row('Gender',s.gender)}
      ${row('Community',s.community)}${row('Caste',s.caste)}
      ${row('Religion',s.religion)}${row('Languages',s.languages)}
      ${row('Physically Challenged',s.physicallyChallenged)}
    </div></div>
    <div class="vp-section"><div class="vp-section-title"><i class="fa fa-location-dot"></i> Address</div><div class="vp-grid">
      ${row('Current Address',s.address)}${row('Permanent Address',s.permanentAddress)}
      ${row('District',s.district)}${row('State',s.state)}
      ${row('Pincode',s.pincode)}${row('Country',s.country)}
    </div></div>
    <div class="vp-section"><div class="vp-section-title"><i class="fa fa-school"></i> Academic Information</div><div class="vp-grid">
      ${row('SSLC Register Number',s.sslcRegisterNumber)}${row('SSLC Board',s.sslcBoard)}
      ${row('SSLC Percentage/CGPA',s.sslcPercentage)}${row('HSC Group',s.hscGroup)}
      ${row('HSC Total',s.hscTotal)}${row('HSC Percentage',s.hscPercentage)}
    </div></div>
    <div class="vp-section"><div class="vp-section-title"><i class="fa fa-people-roof"></i> Parents Information</div><div class="vp-grid">
      ${row("Father's Name",s.fatherName)}${row("Father's Occupation",s.fatherOccupation)}
      ${row("Mother's Name",s.motherName)}${row("Mother's Occupation",s.motherOccupation)}
      ${row('Parents Contact',s.parentsContactNumber)}${row('Annual Income',s.annualIncome)}
      ${row('Number of Siblings',s.siblings)}
    </div></div>
    <div class="vp-section"><div class="vp-section-title"><i class="fa fa-building-columns"></i> Bank Account Details</div><div class="vp-grid">
      ${row('Bank Name',s.bankName)}${row('Branch',s.branch)}
      ${row('Account Number',s.accountNumber)}${row('IFSC',s.ifsc)}${row('MICR',s.micr)}
    </div></div>
    <div class="vp-section"><div class="vp-section-title"><i class="fa fa-award"></i> Scholarship & Other Info</div><div class="vp-grid">
      ${row('First Graduate',s.firstGraduate)}${row('PMSS',s.pmss)}
      ${row('MBC/BC',s.mbcBc)}${row('DNC/BCM/DNT',s.dncBcmDnt)}
      ${row('7.5% Scholarship',s.scholarship75)}${row('Pudhumai Penn',s.pudhumaiPenn)}
      ${row('Tamil Pulhalwan',s.tamilPulhalwan)}${row('Central Scholarship',s.centralScholarship)}
    </div></div>
    <div class="vp-section"><div class="vp-section-title"><i class="fa fa-person-running"></i> Sports & Extracurricular</div><div class="vp-grid">
      ${row('Sports',s.sports)}${row('Extra Curricular',s.extraCurricular)}
    </div></div>`;
  overlay.style.display = '';
}

function printStudentView() {
  const content = document.getElementById('viewStudentContent');
  if (!content) return;
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><title>Student Details</title>
    <style>
      body{font-family:Arial,sans-serif;padding:20px}
      .vp-section{margin-bottom:20px}
      .vp-section-title{font-weight:bold;font-size:1.1rem;border-bottom:2px solid #22c55e;padding-bottom:6px;margin-bottom:10px;color:#22c55e}
      .vp-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
      .vp-row{display:flex;gap:8px;font-size:0.88rem}
      .vp-label{font-weight:600;color:#374151;min-width:160px}
      .vp-val{color:#111}
      img{float:right}
      @media print{body{padding:10px}}
    </style></head><body>${content.innerHTML}</body></html>`);
  w.document.close(); w.focus(); w.print();
}

function exportFilteredStudentsCSV(list) {
  if (!Array.isArray(list)) list = [];
  if (!list.length) { alert('No students to export.'); return; }
  const headers = ['RegisterNumber','Name','Department','Batch','Email','Mobile','Aadhaar','FatherName','MotherName','FirstGraduate','PMSS','MBC_BC','DNC_BCM_DNT','7.5%','PudhumaiPenn','TamilPulhalwan','CentralScholarship'];
  const rows = list.map(s => [
    safe(s.registerNumber), safe(s.name||s.studentName),
    safe(s.ugDepartment||s.pgDepartment||s.department), safe(s.ugBatch||s.pgBatch||s.batch),
    safe(s.studentEmail||s.email), safe(s.mobileNumber), safe(s.aadhaarNumber),
    safe(s.fatherName), safe(s.motherName), safe(s.firstGraduate), safe(s.pmss),
    safe(s.mbcBc), safe(s.dncBcmDnt), safe(s.scholarship75), safe(s.pudhumaiPenn),
    safe(s.tamilPulhalwan), safe(s.centralScholarship)
  ]);
  const csv  = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `students_report_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/* ── Admin Portal: Clear all student data from Firebase ── */
async function clearAllStudentData() {
  if (!confirm('Are you sure? This will permanently delete ALL student data from Firebase!')) return;
  showLoader('Deleting all student data from Firebase…');
  try {
    await clearAllStudents();
    hideLoader();
    alert('✅ All student data cleared from Firebase.');
    const countEl = document.getElementById('portalStudentCount');
    if (countEl) countEl.textContent = '0';
  } catch (e) {
    hideLoader();
    alert('❌ Error: ' + e.message);
  }
}

/* ────────────────────────────────────────────────────────────────
   SECTION 9 — ADD / EDIT STUDENT FORM
   ──────────────────────────────────────────────────────────────── */

let currentStep  = 0;
let photoDataUrl = '';

function initStudentForm() {
  const steps    = document.querySelectorAll('#studentForm .form-step');
  const stepBtns = document.querySelectorAll('#stepNav .step-btn');
  const prevBtn  = document.getElementById('prevBtn');
  const nextBtn  = document.getElementById('nextBtn');
  const saveBtn  = document.getElementById('saveBtn');
  const TOTAL    = steps.length;

  function showStep(n) {
    steps.forEach((s,i) => { s.style.display = i === n ? '' : 'none'; });
    stepBtns.forEach((b,i) => {
      b.classList.toggle('active', i === n);
      if (i < n) b.classList.add('done'); else b.classList.remove('done');
    });
    if (prevBtn) prevBtn.style.display = n === 0 ? 'none' : '';
    if (nextBtn) nextBtn.style.display = n === TOTAL - 1 ? 'none' : '';
    if (saveBtn) saveBtn.style.display = n === TOTAL - 1 ? '' : 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    currentStep = n;
  }

  stepBtns.forEach(b => {
    const fresh = b.cloneNode(true);
    b.parentNode.replaceChild(fresh, b);
    fresh.addEventListener('click', () => showStep(parseInt(fresh.dataset.step, 10)));
  });

  if (nextBtn) {
    const fn = nextBtn.cloneNode(true);
    nextBtn.parentNode.replaceChild(fn, nextBtn);
    fn.addEventListener('click', () => { if (currentStep < TOTAL-1) showStep(currentStep+1); });
    document.getElementById('prevBtn')?.addEventListener('click', () => { if (currentStep > 0) showStep(currentStep-1); });
  }

  showStep(currentStep);

  const photoFile        = document.getElementById('photoFileInput');
  const photoPreviewImg  = document.getElementById('photoPreviewImg');
  const photoPlaceholder = document.getElementById('photoPlaceholderIcon');
  const photoHint        = document.getElementById('photoHintText');
  const photoPreview     = document.getElementById('photoPreview');
  const removeBtn        = document.getElementById('removePhotoBtn');

  if (photoFile) {
    photoFile.onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file || !file.type.startsWith('image/')) { alert('Select a valid image'); return; }
      const reader = new FileReader();
      reader.onload = r => {
        photoDataUrl = r.target.result;
        if (photoPreviewImg)  { photoPreviewImg.src = photoDataUrl; photoPreviewImg.style.display = ''; }
        if (photoPlaceholder)   photoPlaceholder.style.display = 'none';
        if (photoHint)          photoHint.style.display = 'none';
        if (photoPreview)       photoPreview.classList.add('has-photo');
      };
      reader.readAsDataURL(file);
      photoFile.value = '';
    };
  }

  if (removeBtn) {
    removeBtn.onclick = () => {
      photoDataUrl = '';
      if (photoPreviewImg)  { photoPreviewImg.src = ''; photoPreviewImg.style.display = 'none'; }
      if (photoPlaceholder)   photoPlaceholder.style.display = '';
      if (photoHint)          photoHint.style.display = '';
      if (photoPreview)       photoPreview.classList.remove('has-photo');
    };
  }

  document.querySelectorAll('input[name="centralScholarship"]').forEach(r => {
    r.addEventListener('change', () => {
      const wrap = document.getElementById('centralScholarshipSectorWrap');
      if (wrap) wrap.style.display = r.value === 'yes' ? '' : 'none';
    });
  });

  const form = document.getElementById('studentForm');
  if (form) form.onsubmit = (e) => { e.preventDefault(); saveStudentFromForm(); };
}

function resetStudentForm() {
  const form = document.getElementById('studentForm');
  if (form) form.reset();
  photoDataUrl = '';
  const img  = document.getElementById('photoPreviewImg');
  const icon = document.getElementById('photoPlaceholderIcon');
  const hint = document.getElementById('photoHintText');
  const prev = document.getElementById('photoPreview');
  if (img)  { img.src = ''; img.style.display = 'none'; }
  if (icon)   icon.style.display = '';
  if (hint)   hint.style.display = '';
  if (prev)   prev.classList.remove('has-photo');
  document.getElementById('studentId').value = '';
  const fbId = document.getElementById('studentFirebaseId');
  if (fbId) fbId.value = '';
  const sectorWrap = document.getElementById('centralScholarshipSectorWrap');
  if (sectorWrap) sectorWrap.style.display = 'none';
  currentStep = 0;
}

function getFieldVal(id)   { return (document.getElementById(id)?.value || '').trim(); }
function getRadioVal(name) { return document.querySelector(`input[name="${name}"]:checked`)?.value || ''; }

async function saveStudentFromForm() {
  const name = getFieldVal('studentName');
  const reg  = getFieldVal('registerNumber');
  if (!name) { alert('Student Name is required'); return; }
  if (!reg)  { alert('Register Number is required'); return; }

  const student = {
    name, studentName: name, registerNumber: reg,
    Batch: getFieldVal('Batch'), ugBatch: getFieldVal('Batch'),
    ugDepartment: 'ECE', department: 'ECE',
    dateOfBirth: getFieldVal('dateOfBirth'),
    aadhaarNumber: getFieldVal('aadhaarNumber'),
    studentEmail: getFieldVal('studentEmail'),
    mobileNumber: getFieldVal('mobileNumber'),
    bloodGroup: getFieldVal('bloodGroup'),
    gender: getFieldVal('gender'),
    community: getFieldVal('community'),
    caste: getFieldVal('caste'),
    religion: getFieldVal('religion'),
    languages: getFieldVal('languages'),
    physicallyChallenged: getRadioVal('physicallyChallenged'),
    address: getFieldVal('address'),
    permanentAddress: getFieldVal('permanentAddress'),
    country: getFieldVal('country'),
    state: getFieldVal('state'),
    district: getFieldVal('district'),
    taluk: getFieldVal('taluk'),
    village: getFieldVal('village'),
    pincode: getFieldVal('pincode'),
    sslcRegisterNumber: getFieldVal('sslcRegisterNumber'),
    sslcBoard: getFieldVal('sslcBoard'),
    sslcPercentage: getFieldVal('sslcPercentage'),
    hscGroup: getFieldVal('hscGroup'),
    hscTotal: getFieldVal('hscTotal'),
    hscPercentage: getFieldVal('hscPercentage'),
    fatherName: getFieldVal('fatherName'),
    fatherOccupation: getFieldVal('fatherOccupation'),
    motherName: getFieldVal('motherName'),
    motherOccupation: getFieldVal('motherOccupation'),
    parentsContactNumber: getFieldVal('parentsContactNumber'),
    annualIncome: getFieldVal('annualIncome'),
    siblings: getFieldVal('siblings'),
    bankName: getFieldVal('bankName'),
    branch: getFieldVal('branch'),
    accountNumber: getFieldVal('accountNumber'),
    ifsc: getFieldVal('ifsc'),
    firstGraduate: getRadioVal('firstGraduate'),
    pmss: getRadioVal('pmss'),
    mbcBc: getRadioVal('mbcBc'),
    dncBcmDnt: getRadioVal('dncBcmDnt'),
    scholarship75: getRadioVal('scholarship75'),
    pudhumaiPenn: getRadioVal('pudhumaiPenn'),
    tamilPulhalwan: getRadioVal('tamilPulhalwan'),
    centralScholarship: getRadioVal('centralScholarship'),
    centralScholarshipSector: getFieldVal('centralScholarshipSector'),
    sports: getFieldVal('sports'),
    extraCurricular: getFieldVal('extraCurricular'),
    photo: photoDataUrl || '',
  };

  const firestoreId = getFieldVal('studentFirebaseId');
  showLoader(firestoreId ? 'Updating student in Firebase…' : 'Saving student to Firebase…');
  try {
    await saveStudent(student, firestoreId || null);
    hideLoader();
    alert(firestoreId ? '✅ Student updated successfully!' : '✅ Student saved successfully!');
    navigate('profiles');
  } catch (e) {
    hideLoader();
    alert('❌ Error saving student: ' + e.message);
    console.error(e);
  }
}

function populateFormFromStudent(s) {
  const setVal   = (id, val)  => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  const setRadio = (name, val) => {
    if (!val) return;
    const r = document.querySelector(`input[name="${name}"][value="${val}"]`);
    if (r) r.checked = true;
  };
  setVal('studentName', s.name||s.studentName);
  setVal('registerNumber', s.registerNumber);
  setVal('Batch', s.Batch||s.ugBatch);
  setVal('dateOfBirth', s.dateOfBirth);
  setVal('aadhaarNumber', s.aadhaarNumber);
  setVal('studentEmail', s.studentEmail);
  setVal('mobileNumber', s.mobileNumber);
  setVal('bloodGroup', s.bloodGroup);
  setVal('gender', s.gender);
  setVal('community', s.community);
  setVal('caste', s.caste);
  setVal('religion', s.religion);
  setVal('languages', s.languages);
  setRadio('physicallyChallenged', s.physicallyChallenged);
  setVal('address', s.address);
  setVal('permanentAddress', s.permanentAddress);
  setVal('country', s.country);
  setVal('state', s.state);
  setVal('district', s.district);
  setVal('taluk', s.taluk);
  setVal('village', s.village);
  setVal('pincode', s.pincode);
  setVal('sslcRegisterNumber', s.sslcRegisterNumber);
  setVal('sslcBoard', s.sslcBoard);
  setVal('sslcPercentage', s.sslcPercentage);
  setVal('hscGroup', s.hscGroup);
  setVal('hscTotal', s.hscTotal);
  setVal('hscPercentage', s.hscPercentage);
  setVal('fatherName', s.fatherName);
  setVal('fatherOccupation', s.fatherOccupation);
  setVal('motherName', s.motherName);
  setVal('motherOccupation', s.motherOccupation);
  setVal('parentsContactNumber', s.parentsContactNumber);
  setVal('annualIncome', s.annualIncome);
  setVal('siblings', s.siblings);
  setVal('bankName', s.bankName);
  setVal('branch', s.branch);
  setVal('accountNumber', s.accountNumber);
  setVal('ifsc', s.ifsc);
  setRadio('firstGraduate', s.firstGraduate);
  setRadio('pmss', s.pmss);
  setRadio('mbcBc', s.mbcBc);
  setRadio('dncBcmDnt', s.dncBcmDnt);
  setRadio('scholarship75', s.scholarship75);
  setRadio('pudhumaiPenn', s.pudhumaiPenn);
  setRadio('tamilPulhalwan', s.tamilPulhalwan);
  setRadio('centralScholarship', s.centralScholarship);
  setVal('centralScholarshipSector', s.centralScholarshipSector);
  if (s.centralScholarship === 'yes') {
    const wrap = document.getElementById('centralScholarshipSectorWrap');
    if (wrap) wrap.style.display = '';
  }
  setVal('sports', s.sports);
  setVal('extraCurricular', s.extraCurricular);
  if (s.photo) {
    photoDataUrl = s.photo;
    const img  = document.getElementById('photoPreviewImg');
    const icon = document.getElementById('photoPlaceholderIcon');
    const hint = document.getElementById('photoHintText');
    const prev = document.getElementById('photoPreview');
    if (img)  { img.src = s.photo; img.style.display = ''; }
    if (icon)   icon.style.display = 'none';
    if (hint)   hint.style.display = 'none';
    if (prev)   prev.classList.add('has-photo');
  }
}

/* ────────────────────────────────────────────────────────────────
   SECTION 10 — INIT
   ──────────────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  generateCaptcha();
  initSidebar();
  initDarkMode();
  initTopbarSearch();

  const loginPage = document.getElementById('page-login');
  if (loginPage) { loginPage.classList.add('active'); loginPage.style.display = ''; }
  const appShell = document.getElementById('app-shell');
  if (appShell) appShell.style.display = 'none';

  const userTypeEl = document.getElementById('user-type');
  if (userTypeEl) {
    userTypeEl.addEventListener('change', () => {
      togglePasswordSection();
      toggleOTPSection();
    });
    togglePasswordSection();
    toggleOTPSection();
  }

  document.getElementById('captcha-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') validateLogin();
  });
  document.getElementById('otp-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') validateLogin();
  });
});

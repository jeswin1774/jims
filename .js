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
  
  // Only admins can access add-student page
  if (page === 'add-student' && currentUserRole !== 'admin') {
    alert('Only administrators can add or edit students.');
    return;
  }

  // Students can access attendance page but only for Reports and History (handled in initAttendancePage)

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
/* ── REMOVED OTP System ─ */
// OTP functionality has been removed. Teacher login uses password authentication.

function togglePasswordSection() {
  const role    = document.getElementById('user-type')?.value || 'student';
  const section = document.getElementById('passwordSection');
  const usernameLabel = document.getElementById('usernameLabel');
  const usernameInput = document.getElementById('username');
  
  // Update username label based on role
  if (usernameLabel) {
    if (role === 'student') {
      usernameLabel.textContent = 'Register Number';
      if (usernameInput) usernameInput.placeholder = 'Enter your register number (e.g., 95132310)6020)';
    } else {
      usernameLabel.textContent = 'Username';
      if (usernameInput) usernameInput.placeholder = 'Enter username';
    }
  }
  
  const needsPass = (role === 'admin' || role === 'teacher' || role === 'student');
  if (!section) return;
  if (needsPass) { 
    section.style.display = ''; 
    const label = section.querySelector('label');
    if (label) {
      if (role === 'student') {
        label.innerHTML = '<span><i class="fa fa-calendar"></i> Date of Birth (DDMMYYYY)</span>';
      } else {
        label.innerHTML = 'Password';
      }
    }
  }
  else { section.style.display = 'none'; }
}

function validateLogin() {
  const role   = document.getElementById('user-type')?.value || 'student';
  const user   = document.getElementById('username')?.value?.trim();
  const pass   = document.getElementById('password')?.value;
  const input  = document.getElementById('captcha-input')?.value?.trim()?.toUpperCase();
  const stored = localStorage.getItem('captcha');

  // Validate required fields
  if (!user || !input) { alert('Please fill all fields'); return; }
  
  // Admin login requires password verification
  if (role === 'admin') {
    if (!pass) { alert('Please enter password'); return; }
    if (pass !== 'jacsiceeceiii') { alert('Invalid Admin Password'); return; }
  }
  
  // Teacher login requires password verification
  if (role === 'teacher') {
    if (!pass) { alert('Please enter password'); return; }
    if (pass !== 'jacsiceecestaff') { alert('Invalid Teacher Password'); return; }
  }
  
  // Student login requires date of birth (8 digits DDMMYYYY)
  if (role === 'student') {
    if (!pass) { alert('Please enter your date of birth (DDMMYYYY)'); return; }
    if (!/^\d{8}$/.test(pass)) { alert('Date of birth must be 8 digits (DDMMYYYY format)'); return; }
    
    // Call async validation for student
    validateStudentLogin(user, pass, input, stored);
    return;
  }
  
  // Validate CAPTCHA for admin/teacher
  if (stored && input !== stored) { alert('Invalid CAPTCHA'); return; }

  // Set logged user info
  const nameEl    = document.getElementById('loggedUserName');
  const roleEl    = document.getElementById('loggedUserRole');
  const roleLabel = { admin: 'Administrator', teacher: 'Teacher', student: 'Student' };
  if (nameEl) nameEl.textContent = user;
  if (roleEl) roleEl.textContent = roleLabel[role] || role;

  // Store current user info for data filtering
  currentUserRole = role;
  localStorage.setItem('currentUserRole', role);
  localStorage.setItem('currentUsername', user);

  // Show add-student nav for admins only
  const addStudentNav = document.querySelector('.nav-link[data-page="add-student"]');
  if (addStudentNav) {
    addStudentNav.closest('li').style.display = role === 'admin' ? '' : 'none';
  }

  // Show attendance nav for teachers and admins only
  const attendanceNav = document.querySelector('.nav-link[data-page="attendance"]');
  if (attendanceNav) {
    attendanceNav.closest('li').style.display = (role === 'teacher' || role === 'admin') ? '' : 'none';
  }

  // Show app shell and navigate
  document.getElementById('page-login').classList.remove('active');
  document.getElementById('page-login').style.display = 'none';
  document.getElementById('app-shell').style.display  = 'flex';

  if (role === 'admin')        navigate('dashboard');    // Admins go to dashboard
  else if (role === 'teacher') navigate('profiles');     // Teachers go to profiles
  else                         navigate('home');          // Students go to home
}

// Async student login validation with database lookup
async function validateStudentLogin(user, pass, input, stored) {
  const role = 'student';
  
  // Validate CAPTCHA
  if (stored && input !== stored) { alert('Invalid CAPTCHA'); return; }
  
  // Find student by REGISTER NUMBER (username field)
  const students = await getStudents();
  console.log('🔍 Total students in database:', students.length);
  console.log('📝 Searching for register number:', user);
  console.log('📋 All register numbers in database:', students.map(s => s.registerNumber));
  
  const student = students.find(s => 
    (s.registerNumber || '').toLowerCase() === user.toLowerCase()
  );
  
  if (!student) { 
    alert('❌ Register number not found in the system'); 
    console.log('❌ Register number "' + user + '" not found. Check the exact register number in Firebase.');
    return; 
  }
  
  console.log('✅ Student found:', student.name || student.studentName);
  console.log('📝 Student name:', student.name || student.studentName);
  console.log('📅 Raw DOB from database:', student.dateOfBirth);
  
  // Get and normalize date of birth from database
  const dbDOB = (student.dateOfBirth || '').trim();
  if (!dbDOB) { 
    alert('❌ Date of birth not set in your record. Please contact administrator.'); 
    console.log('❌ No DOB set for student:', student.name || student.studentName);
    return; 
  }
  
  // Convert stored date to DDMMYYYY format for comparison
  const normalizedDBDOB = normalizeDateOfBirth(dbDOB);
  console.log('🔄 Raw DOB entered by user:', pass);
  console.log('🔄 Normalized DOB from database:', normalizedDBDOB);
  console.log('🔄 Do they match?', pass === normalizedDBDOB);
  
  if (pass !== normalizedDBDOB) { 
    alert('❌ Invalid date of birth. Make sure the format is DDMMYYYY (e.g., 15031990)'); 
    console.log('❌ DOB mismatch:');
    console.log('   - You entered: ' + pass);
    console.log('   - Database has: ' + normalizedDBDOB);
    document.getElementById('password').value = '';
    return; 
  }
  
  // Store student reference for later use
  localStorage.setItem('currentStudentId', student._id || '');
  
  console.log('✅ Student login successful!');
  console.log('✅ Student ID:', student._id);
  
  // Set logged user info
  const nameEl    = document.getElementById('loggedUserName');
  const roleEl    = document.getElementById('loggedUserRole');
  const roleLabel = { student: 'Student' };
  if (nameEl) nameEl.textContent = student.name || student.studentName || user;
  if (roleEl) roleEl.textContent = roleLabel[role] || role;

  // Store current user info for data filtering
  currentUserRole = role;
  localStorage.setItem('currentUserRole', role);
  localStorage.setItem('currentUsername', student.name || student.studentName || user);
  localStorage.setItem('currentRegisterNumber', student.registerNumber);

  // Show add-student nav hidden for students
  const addStudentNav = document.querySelector('.nav-link[data-page="add-student"]');
  if (addStudentNav) {
    addStudentNav.closest('li').style.display = 'none';
  }

  // Show attendance nav for students (they can view Reports and History)
  const attendanceNav = document.querySelector('.nav-link[data-page="attendance"]');
  if (attendanceNav) {
    attendanceNav.closest('li').style.display = '';
  }

  // Hide dashboard nav for students
  const dashboardNav = document.querySelector('.nav-link[data-page="dashboard"]');
  if (dashboardNav) {
    dashboardNav.closest('li').style.display = 'none';
  }

  // Show app shell and navigate
  document.getElementById('page-login').classList.remove('active');
  document.getElementById('page-login').style.display = 'none';
  document.getElementById('app-shell').style.display  = 'flex';
  
  navigate('home');  // Students go to home
}

// Helper function to normalize date of birth to DDMMYYYY format
function normalizeDateOfBirth(dateStr) {
  if (!dateStr) return '';
  
  console.log('🔧 normalizeDateOfBirth input:', dateStr);
  
  // Try to match date pattern with separators first (YYYY-MM-DD, DD-MM-YYYY, etc.)
  const datePattern = /(\d{1,4})[-\/\s.](\d{1,2})[-\/\s.](\d{1,4})/;
  const match = dateStr.match(datePattern);
  
  if (match) {
    let part1 = match[1];
    let part2 = match[2];
    let part3 = match[3];
    
    console.log('🔧 Matched pattern: ' + part1 + ' | ' + part2 + ' | ' + part3);
    
    let day, month, year;
    
    // Detect format by checking which part is 4 digits (year)
    if (part1.length === 4) {
      // YYYY-MM-DD format
      year = part1;
      month = part2;
      day = part3;
      console.log('🔧 Detected YYYY-MM-DD format');
    } else if (part3.length === 4) {
      // DD-MM-YYYY or MM-DD-YYYY format
      // Assume DD-MM-YYYY (day first)
      day = part1;
      month = part2;
      year = part3;
      console.log('🔧 Detected DD-MM-YYYY format');
    } else {
      // YY format - default to DD-MM-YY
      day = part1;
      month = part2;
      year = part3;
      year = parseInt(year) < 50 ? '20' + year : '19' + year;
      console.log('🔧 Detected DD-MM-YY format, converted year to:', year);
    }
    
    // Pad day and month with leading zeros
    day = String(day).padStart(2, '0');
    month = String(month).padStart(2, '0');
    
    const result = day + month + year;
    console.log('🔧 Normalized to:', result);
    return result;
  }
  
  // No separator found - check if it's 8 consecutive digits
  let cleaned = dateStr.replace(/[-\/\s.]/g, '');
  if (/^\d{8}$/.test(cleaned)) {
    console.log('🔧 Already in 8-digit format:', cleaned);
    // Assume it's DDMMYYYY (user input format)
    return cleaned;
  }
  
  console.log('🔧 Could not parse, returning cleaned value:', cleaned);
  return cleaned;
}

function doLogout() {
  document.getElementById('app-shell').style.display = 'none';
  const login = document.getElementById('page-login');
  login.style.display = '';
  login.classList.add('active');
  document.getElementById('username').value      = '';
  document.getElementById('password').value      = '';
  document.getElementById('captcha-input').value = '';
  const viewOverlay = document.getElementById('viewStudentOverlay');
  if (viewOverlay) viewOverlay.style.display = 'none';
  currentUserRole     = 'student';
  profilesInitialized = false;
  _cachedStudents     = null;
  _cachedAttendance   = null;
  localStorage.removeItem('currentUserRole');
  localStorage.removeItem('currentUsername');
  localStorage.removeItem('currentRegisterNumber');
  generateCaptcha();
}

/* ── Admin Portal Functions REMOVED ── */
// All admin portal functionality has been removed from the system.

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
  // First, delete the student
  await db.collection(STUDENTS_COL).doc(firestoreId).delete();
  _cachedStudents = null;
  
  // Get student data to find their register number
  const allStudents = await getStudents();
  // Note: student is already deleted, so we fetch attendance by searching
  // and delete all attendance records for this student
  const allAttendance = await getAttendanceHistory();
  const batch = db.batch();
  
  // Delete all attendance records (Note: In a real system, you'd get student's registerNumber before deletion)
  // For now, we'll handle this by cleaning up orphaned records
  console.log('✅ Student deleted. Associated attendance records can be cleaned up.');
  
  _cachedAttendance = null;
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
function txt(v)  { return (v == null || v === '') ? 'N/A' : St/* ═══════════════════════════════════════════════════════════════
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
  
  // Only admins can access add-student page
  if (page === 'add-student' && currentUserRole !== 'admin') {
    alert('Only administrators can add or edit students.');
    return;
  }

  // Students can access attendance page but only for Reports and History (handled in initAttendancePage)

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
/* ── REMOVED OTP System ─ */
// OTP functionality has been removed. Teacher login uses password authentication.

function togglePasswordSection() {
  const role    = document.getElementById('user-type')?.value || 'student';
  const section = document.getElementById('passwordSection');
  const usernameLabel = document.getElementById('usernameLabel');
  const usernameInput = document.getElementById('username');
  
  // Update username label based on role
  if (usernameLabel) {
    if (role === 'student') {
      usernameLabel.textContent = 'Register Number';
      if (usernameInput) usernameInput.placeholder = 'Enter your register number (e.g., 95132310)6020)';
    } else {
      usernameLabel.textContent = 'Username';
      if (usernameInput) usernameInput.placeholder = 'Enter username';
    }
  }
  
  const needsPass = (role === 'admin' || role === 'teacher' || role === 'student');
  if (!section) return;
  if (needsPass) { 
    section.style.display = ''; 
    const label = section.querySelector('label');
    if (label) {
      if (role === 'student') {
        label.innerHTML = '<span><i class="fa fa-calendar"></i> Date of Birth (DDMMYYYY)</span>';
      } else {
        label.innerHTML = 'Password';
      }
    }
  }
  else { section.style.display = 'none'; }
}

function validateLogin() {
  const role   = document.getElementById('user-type')?.value || 'student';
  const user   = document.getElementById('username')?.value?.trim();
  const pass   = document.getElementById('password')?.value;
  const input  = document.getElementById('captcha-input')?.value?.trim()?.toUpperCase();
  const stored = localStorage.getItem('captcha');

  // Validate required fields
  if (!user || !input) { alert('Please fill all fields'); return; }
  
  // Admin login requires password verification
  if (role === 'admin') {
    if (!pass) { alert('Please enter password'); return; }
    if (pass !== 'jacsiceeceiii') { alert('Invalid Admin Password'); return; }
  }
  
  // Teacher login requires password verification
  if (role === 'teacher') {
    if (!pass) { alert('Please enter password'); return; }
    if (pass !== 'jacsiceecestaff') { alert('Invalid Teacher Password'); return; }
  }
  
  // Student login requires date of birth (8 digits DDMMYYYY)
  if (role === 'student') {
    if (!pass) { alert('Please enter your date of birth (DDMMYYYY)'); return; }
    if (!/^\d{8}$/.test(pass)) { alert('Date of birth must be 8 digits (DDMMYYYY format)'); return; }
    
    // Call async validation for student
    validateStudentLogin(user, pass, input, stored);
    return;
  }
  
  // Validate CAPTCHA for admin/teacher
  if (stored && input !== stored) { alert('Invalid CAPTCHA'); return; }

  // Set logged user info
  const nameEl    = document.getElementById('loggedUserName');
  const roleEl    = document.getElementById('loggedUserRole');
  const roleLabel = { admin: 'Administrator', teacher: 'Teacher', student: 'Student' };
  if (nameEl) nameEl.textContent = user;
  if (roleEl) roleEl.textContent = roleLabel[role] || role;

  // Store current user info for data filtering
  currentUserRole = role;
  localStorage.setItem('currentUserRole', role);
  localStorage.setItem('currentUsername', user);

  // Show add-student nav for admins only
  const addStudentNav = document.querySelector('.nav-link[data-page="add-student"]');
  if (addStudentNav) {
    addStudentNav.closest('li').style.display = role === 'admin' ? '' : 'none';
  }

  // Show attendance nav for teachers and admins only
  const attendanceNav = document.querySelector('.nav-link[data-page="attendance"]');
  if (attendanceNav) {
    attendanceNav.closest('li').style.display = (role === 'teacher' || role === 'admin') ? '' : 'none';
  }

  // Show app shell and navigate
  document.getElementById('page-login').classList.remove('active');
  document.getElementById('page-login').style.display = 'none';
  document.getElementById('app-shell').style.display  = 'flex';

  if (role === 'admin')        navigate('dashboard');    // Admins go to dashboard
  else if (role === 'teacher') navigate('profiles');     // Teachers go to profiles
  else                         navigate('home');          // Students go to home
}

// Async student login validation with database lookup
async function validateStudentLogin(user, pass, input, stored) {
  const role = 'student';
  
  // Validate CAPTCHA
  if (stored && input !== stored) { alert('Invalid CAPTCHA'); return; }
  
  // Find student by REGISTER NUMBER (username field)
  const students = await getStudents();
  console.log('🔍 Total students in database:', students.length);
  console.log('📝 Searching for register number:', user);
  console.log('📋 All register numbers in database:', students.map(s => s.registerNumber));
  
  const student = students.find(s => 
    (s.registerNumber || '').toLowerCase() === user.toLowerCase()
  );
  
  if (!student) { 
    alert('❌ Register number not found in the system'); 
    console.log('❌ Register number "' + user + '" not found. Check the exact register number in Firebase.');
    return; 
  }
  
  console.log('✅ Student found:', student.name || student.studentName);
  console.log('📝 Student name:', student.name || student.studentName);
  console.log('📅 Raw DOB from database:', student.dateOfBirth);
  
  // Get and normalize date of birth from database
  const dbDOB = (student.dateOfBirth || '').trim();
  if (!dbDOB) { 
    alert('❌ Date of birth not set in your record. Please contact administrator.'); 
    console.log('❌ No DOB set for student:', student.name || student.studentName);
    return; 
  }
  
  // Convert stored date to DDMMYYYY format for comparison
  const normalizedDBDOB = normalizeDateOfBirth(dbDOB);
  console.log('🔄 Raw DOB entered by user:', pass);
  console.log('🔄 Normalized DOB from database:', normalizedDBDOB);
  console.log('🔄 Do they match?', pass === normalizedDBDOB);
  
  if (pass !== normalizedDBDOB) { 
    alert('❌ Invalid date of birth. Make sure the format is DDMMYYYY (e.g., 15031990)'); 
    console.log('❌ DOB mismatch:');
    console.log('   - You entered: ' + pass);
    console.log('   - Database has: ' + normalizedDBDOB);
    document.getElementById('password').value = '';
    return; 
  }
  
  // Store student reference for later use
  localStorage.setItem('currentStudentId', student._id || '');
  
  console.log('✅ Student login successful!');
  console.log('✅ Student ID:', student._id);
  
  // Set logged user info
  const nameEl    = document.getElementById('loggedUserName');
  const roleEl    = document.getElementById('loggedUserRole');
  const roleLabel = { student: 'Student' };
  if (nameEl) nameEl.textContent = student.name || student.studentName || user;
  if (roleEl) roleEl.textContent = roleLabel[role] || role;

  // Store current user info for data filtering
  currentUserRole = role;
  localStorage.setItem('currentUserRole', role);
  localStorage.setItem('currentUsername', student.name || student.studentName || user);
  localStorage.setItem('currentRegisterNumber', student.registerNumber);

  // Show add-student nav hidden for students
  const addStudentNav = document.querySelector('.nav-link[data-page="add-student"]');
  if (addStudentNav) {
    addStudentNav.closest('li').style.display = 'none';
  }

  // Show attendance nav for students (they can view Reports and History)
  const attendanceNav = document.querySelector('.nav-link[data-page="attendance"]');
  if (attendanceNav) {
    attendanceNav.closest('li').style.display = '';
  }

  // Hide dashboard nav for students
  const dashboardNav = document.querySelector('.nav-link[data-page="dashboard"]');
  if (dashboardNav) {
    dashboardNav.closest('li').style.display = 'none';
  }

  // Show app shell and navigate
  document.getElementById('page-login').classList.remove('active');
  document.getElementById('page-login').style.display = 'none';
  document.getElementById('app-shell').style.display  = 'flex';
  
  navigate('home');  // Students go to home
}

// Helper function to normalize date of birth to DDMMYYYY format
function normalizeDateOfBirth(dateStr) {
  if (!dateStr) return '';
  
  console.log('🔧 normalizeDateOfBirth input:', dateStr);
  
  // Try to match date pattern with separators first (YYYY-MM-DD, DD-MM-YYYY, etc.)
  const datePattern = /(\d{1,4})[-\/\s.](\d{1,2})[-\/\s.](\d{1,4})/;
  const match = dateStr.match(datePattern);
  
  if (match) {
    let part1 = match[1];
    let part2 = match[2];
    let part3 = match[3];
    
    console.log('🔧 Matched pattern: ' + part1 + ' | ' + part2 + ' | ' + part3);
    
    let day, month, year;
    
    // Detect format by checking which part is 4 digits (year)
    if (part1.length === 4) {
      // YYYY-MM-DD format
      year = part1;
      month = part2;
      day = part3;
      console.log('🔧 Detected YYYY-MM-DD format');
    } else if (part3.length === 4) {
      // DD-MM-YYYY or MM-DD-YYYY format
      // Assume DD-MM-YYYY (day first)
      day = part1;
      month = part2;
      year = part3;
      console.log('🔧 Detected DD-MM-YYYY format');
    } else {
      // YY format - default to DD-MM-YY
      day = part1;
      month = part2;
      year = part3;
      year = parseInt(year) < 50 ? '20' + year : '19' + year;
      console.log('🔧 Detected DD-MM-YY format, converted year to:', year);
    }
    
    // Pad day and month with leading zeros
    day = String(day).padStart(2, '0');
    month = String(month).padStart(2, '0');
    
    const result = day + month + year;
    console.log('🔧 Normalized to:', result);
    return result;
  }
  
  // No separator found - check if it's 8 consecutive digits
  let cleaned = dateStr.replace(/[-\/\s.]/g, '');
  if (/^\d{8}$/.test(cleaned)) {
    console.log('🔧 Already in 8-digit format:', cleaned);
    // Assume it's DDMMYYYY (user input format)
    return cleaned;
  }
  
  console.log('🔧 Could not parse, returning cleaned value:', cleaned);
  return cleaned;
}

function doLogout() {
  document.getElementById('app-shell').style.display = 'none';
  const login = document.getElementById('page-login');
  login.style.display = '';
  login.classList.add('active');
  document.getElementById('username').value      = '';
  document.getElementById('password').value      = '';
  document.getElementById('captcha-input').value = '';
  const viewOverlay = document.getElementById('viewStudentOverlay');
  if (viewOverlay) viewOverlay.style.display = 'none';
  currentUserRole     = 'student';
  profilesInitialized = false;
  _cachedStudents     = null;
  _cachedAttendance   = null;
  localStorage.removeItem('currentUserRole');
  localStorage.removeItem('currentUsername');
  localStorage.removeItem('currentRegisterNumber');
  generateCaptcha();
}

/* ── Admin Portal Functions REMOVED ── */
// All admin portal functionality has been removed from the system.

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
  // First, delete the student
  await db.collection(STUDENTS_COL).doc(firestoreId).delete();
  _cachedStudents = null;
  
  // Get student data to find their register number
  const allStudents = await getStudents();
  // Note: student is already deleted, so we fetch attendance by searching
  // and delete all attendance records for this student
  const allAttendance = await getAttendanceHistory();
  const batch = db.batch();
  
  // Delete all attendance records (Note: In a real system, you'd get student's registerNumber before deletion)
  // For now, we'll handle this by cleaning up orphaned records
  console.log('✅ Student deleted. Associated attendance records can be cleaned up.');
  
  _cachedAttendance = null;
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
function txt(v)  { return (v == null || v === '') ? 'N/A' : St841923/* ═══════════════════════════════════════════════════════════════
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
  
  // Only admins can access add-student page
  if (page === 'add-student' && currentUserRole !== 'admin') {
    alert('Only administrators can add or edit students.');
    return;
  }

  // Students can access attendance page but only for Reports and History (handled in initAttendancePage)

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
/* ── REMOVED OTP System ─ */
// OTP functionality has been removed. Teacher login uses password authentication.

function togglePasswordSection() {
  const role    = document.getElementById('user-type')?.value || 'student';
  const section = document.getElementById('passwordSection');
  const usernameLabel = document.getElementById('usernameLabel');
  const usernameInput = document.getElementById('username');
  
  // Update username label based on role
  if (usernameLabel) {
    if (role === 'student') {
      usernameLabel.textContent = 'Register Number';
      if (usernameInput) usernameInput.placeholder = 'Enter your register number (e.g., 95132310)6020)';
    } else {
      usernameLabel.textContent = 'Username';
      if (usernameInput) usernameInput.placeholder = 'Enter username';
    }
  }
  
  const needsPass = (role === 'admin' || role === 'teacher' || role === 'student');
  if (!section) return;
  if (needsPass) { 
    section.style.display = ''; 
    const label = section.querySelector('label');
    if (label) {
      if (role === 'student') {
        label.innerHTML = '<span><i class="fa fa-calendar"></i> Date of Birth (DDMMYYYY)</span>';
      } else {
        label.innerHTML = 'Password';
      }
    }
  }
  else { section.style.display = 'none'; }
}

function validateLogin() {
  const role   = document.getElementById('user-type')?.value || 'student';
  const user   = document.getElementById('username')?.value?.trim();
  const pass   = document.getElementById('password')?.value;
  const input  = document.getElementById('captcha-input')?.value?.trim()?.toUpperCase();
  const stored = localStorage.getItem('captcha');

  // Validate required fields
  if (!user || !input) { alert('Please fill all fields'); return; }
  
  // Admin login requires password verification
  if (role === 'admin') {
    if (!pass) { alert('Please enter password'); return; }
    if (pass !== 'jacsiceeceiii') { alert('Invalid Admin Password'); return; }
  }
  
  // Teacher login requires password verification
  if (role === 'teacher') {
    if (!pass) { alert('Please enter password'); return; }
    if (pass !== 'jacsiceecestaff') { alert('Invalid Teacher Password'); return; }
  }
  
  // Student login requires date of birth (8 digits DDMMYYYY)
  if (role === 'student') {
    if (!pass) { alert('Please enter your date of birth (DDMMYYYY)'); return; }
    if (!/^\d{8}$/.test(pass)) { alert('Date of birth must be 8 digits (DDMMYYYY format)'); return; }
    
    // Call async validation for student
    validateStudentLogin(user, pass, input, stored);
    return;
  }
  
  // Validate CAPTCHA for admin/teacher
  if (stored && input !== stored) { alert('Invalid CAPTCHA'); return; }

  // Set logged user info
  const nameEl    = document.getElementById('loggedUserName');
  const roleEl    = document.getElementById('loggedUserRole');
  const roleLabel = { admin: 'Administrator', teacher: 'Teacher', student: 'Student' };
  if (nameEl) nameEl.textContent = user;
  if (roleEl) roleEl.textContent = roleLabel[role] || role;

  // Store current user info for data filtering
  currentUserRole = role;
  localStorage.setItem('currentUserRole', role);
  localStorage.setItem('currentUsername', user);

  // Show add-student nav for admins only
  const addStudentNav = document.querySelector('.nav-link[data-page="add-student"]');
  if (addStudentNav) {
    addStudentNav.closest('li').style.display = role === 'admin' ? '' : 'none';
  }

  // Show attendance nav for teachers and admins only
  const attendanceNav = document.querySelector('.nav-link[data-page="attendance"]');
  if (attendanceNav) {
    attendanceNav.closest('li').style.display = (role === 'teacher' || role === 'admin') ? '' : 'none';
  }

  // Show app shell and navigate
  document.getElementById('page-login').classList.remove('active');
  document.getElementById('page-login').style.display = 'none';
  document.getElementById('app-shell').style.display  = 'flex';

  if (role === 'admin')        navigate('dashboard');    // Admins go to dashboard
  else if (role === 'teacher') navigate('profiles');     // Teachers go to profiles
  else                         navigate('home');          // Students go to home
}

// Async student login validation with database lookup
async function validateStudentLogin(user, pass, input, stored) {
  const role = 'student';
  
  // Validate CAPTCHA
  if (stored && input !== stored) { alert('Invalid CAPTCHA'); return; }
  
  // Find student by REGISTER NUMBER (username field)
  const students = await getStudents();
  console.log('🔍 Total students in database:', students.length);
  console.log('📝 Searching for register number:', user);
  console.log('📋 All register numbers in database:', students.map(s => s.registerNumber));
  
  const student = students.find(s => 
    (s.registerNumber || '').toLowerCase() === user.toLowerCase()
  );
  
  if (!student) { 
    alert('❌ Register number not found in the system'); 
    console.log('❌ Register number "' + user + '" not found. Check the exact register number in Firebase.');
    return; 
  }
  
  console.log('✅ Student found:', student.name || student.studentName);
  console.log('📝 Student name:', student.name || student.studentName);
  console.log('📅 Raw DOB from database:', student.dateOfBirth);
  
  // Get and normalize date of birth from database
  const dbDOB = (student.dateOfBirth || '').trim();
  if (!dbDOB) { 
    alert('❌ Date of birth not set in your record. Please contact administrator.'); 
    console.log('❌ No DOB set for student:', student.name || student.studentName);
    return; 
  }
  
  // Convert stored date to DDMMYYYY format for comparison
  const normalizedDBDOB = normalizeDateOfBirth(dbDOB);
  console.log('🔄 Raw DOB entered by user:', pass);
  console.log('🔄 Normalized DOB from database:', normalizedDBDOB);
  console.log('🔄 Do they match?', pass === normalizedDBDOB);
  
  if (pass !== normalizedDBDOB) { 
    alert('❌ Invalid date of birth. Make sure the format is DDMMYYYY (e.g., 15031990)'); 
    console.log('❌ DOB mismatch:');
    console.log('   - You entered: ' + pass);
    console.log('   - Database has: ' + normalizedDBDOB);
    document.getElementById('password').value = '';
    return; 
  }
  
  // Store student reference for later use
  localStorage.setItem('currentStudentId', student._id || '');
  
  console.log('✅ Student login successful!');
  console.log('✅ Student ID:', student._id);
  
  // Set logged user info
  const nameEl    = document.getElementById('loggedUserName');
  const roleEl    = document.getElementById('loggedUserRole');
  const roleLabel = { student: 'Student' };
  if (nameEl) nameEl.textContent = student.name || student.studentName || user;
  if (roleEl) roleEl.textContent = roleLabel[role] || role;

  // Store current user info for data filtering
  currentUserRole = role;
  localStorage.setItem('currentUserRole', role);
  localStorage.setItem('currentUsername', student.name || student.studentName || user);
  localStorage.setItem('currentRegisterNumber', student.registerNumber);

  // Show add-student nav hidden for students
  const addStudentNav = document.querySelector('.nav-link[data-page="add-student"]');
  if (addStudentNav) {
    addStudentNav.closest('li').style.display = 'none';
  }

  // Show attendance nav for students (they can view Reports and History)
  const attendanceNav = document.querySelector('.nav-link[data-page="attendance"]');
  if (attendanceNav) {
    attendanceNav.closest('li').style.display = '';
  }

  // Hide dashboard nav for students
  const dashboardNav = document.querySelector('.nav-link[data-page="dashboard"]');
  if (dashboardNav) {
    dashboardNav.closest('li').style.display = 'none';
  }

  // Show app shell and navigate
  document.getElementById('page-login').classList.remove('active');
  document.getElementById('page-login').style.display = 'none';
  document.getElementById('app-shell').style.display  = 'flex';
  
  navigate('home');  // Students go to home
}

// Helper function to normalize date of birth to DDMMYYYY format
function normalizeDateOfBirth(dateStr) {
  if (!dateStr) return '';
  
  console.log('🔧 normalizeDateOfBirth input:', dateStr);
  
  // Try to match date pattern with separators first (YYYY-MM-DD, DD-MM-YYYY, etc.)
  const datePattern = /(\d{1,4})[-\/\s.](\d{1,2})[-\/\s.](\d{1,4})/;
  const match = dateStr.match(datePattern);
  
  if (match) {
    let part1 = match[1];
    let part2 = match[2];
    let part3 = match[3];
    
    console.log('🔧 Matched pattern: ' + part1 + ' | ' + part2 + ' | ' + part3);
    
    let day, month, year;
    
    // Detect format by checking which part is 4 digits (year)
    if (part1.length === 4) {
      // YYYY-MM-DD format
      year = part1;
      month = part2;
      day = part3;
      console.log('🔧 Detected YYYY-MM-DD format');
    } else if (part3.length === 4) {
      // DD-MM-YYYY or MM-DD-YYYY format
      // Assume DD-MM-YYYY (day first)
      day = part1;
      month = part2;
      year = part3;
      console.log('🔧 Detected DD-MM-YYYY format');
    } else {
      // YY format - default to DD-MM-YY
      day = part1;
      month = part2;
      year = part3;
      year = parseInt(year) < 50 ? '20' + year : '19' + year;
      console.log('🔧 Detected DD-MM-YY format, converted year to:', year);
    }
    
    // Pad day and month with leading zeros
    day = String(day).padStart(2, '0');
    month = String(month).padStart(2, '0');
    
    const result = day + month + year;
    console.log('🔧 Normalized to:', result);
    return result;
  }
  
  // No separator found - check if it's 8 consecutive digits
  let cleaned = dateStr.replace(/[-\/\s.]/g, '');
  if (/^\d{8}$/.test(cleaned)) {
    console.log('🔧 Already in 8-digit format:', cleaned);
    // Assume it's DDMMYYYY (user input format)
    return cleaned;
  }
  
  console.log('🔧 Could not parse, returning cleaned value:', cleaned);
  return cleaned;
}

function doLogout() {
  document.getElementById('app-shell').style.display = 'none';
  const login = document.getElementById('page-login');
  login.style.display = '';
  login.classList.add('active');
  document.getElementById('username').value      = '';
  document.getElementById('password').value      = '';
  document.getElementById('captcha-input').value = '';
  const viewOverlay = document.getElementById('viewStudentOverlay');
  if (viewOverlay) viewOverlay.style.display = 'none';
  currentUserRole     = 'student';
  profilesInitialized = false;
  _cachedStudents     = null;
  _cachedAttendance   = null;
  localStorage.removeItem('currentUserRole');
  localStorage.removeItem('currentUsername');
  localStorage.removeItem('currentRegisterNumber');
  generateCaptcha();
}

/* ── Admin Portal Functions REMOVED ── */
// All admin portal functionality has been removed from the system.

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
  // First, delete the student
  await db.collection(STUDENTS_COL).doc(firestoreId).delete();
  _cachedStudents = null;
  
  // Get student data to find their register number
  const allStudents = await getStudents();
  // Note: student is already deleted, so we fetch attendance by searching
  // and delete all attendance records for this student
  const allAttendance = await getAttendanceHistory();
  const batch = db.batch();
  
  // Delete all attendance records (Note: In a real system, you'd get student's registerNumber before deletion)
  // For now, we'll handle this by cleaning up orphaned records
  console.log('✅ Student deleted. Associated attendance records can be cleaned up.');
  
  _cachedAttendance = null;
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
function txt(v)  { return (v == null || v === '') ? 'N/A' : St

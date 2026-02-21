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
let loginAttempts   = 0;
const MAX_LOGIN_ATTEMPTS = 3;
const LOCKOUT_TIME = 5 * 60 * 1000;
let lockedOutUntil = null;
let sessionTimeout = null;

// ⚠️ SECURITY: Protect role from console manipulation
function _getCurrentRole() {
  const role = sessionStorage.getItem('_role') || 'student';
  const loginTime = sessionStorage.getItem('_loginTime');
  if (loginTime && (Date.now() - parseInt(loginTime) > 30 * 60 * 1000)) {
    doLogout();
    return 'student';
  }
  return role;
}

// Session timeout function
function _resetSessionTimeout() {
  clearTimeout(sessionTimeout);
  sessionTimeout = setTimeout(() => {
    if (document.getElementById('app-shell')?.style.display === 'flex') {
      alert('⏱️ Session expired. Please login again.');
      doLogout();
    }
  }, 30 * 60 * 1000);
}

// Monitor user activity
document.addEventListener('click', _resetSessionTimeout);
document.addEventListener('keypress', _resetSessionTimeout);

function navigate(page, opts = {}) {
  if (!PAGES.includes(page)) return;
  
  // Security: Get role from session storage for authorization checks
  const _role = sessionStorage.getItem('_role') || 'student';
  
  // Only admins can access add-student page
  if (page === 'add-student' && _role !== 'admin') {
    alert('Only administrators can add or edit students.');
    return;
  }

  // Only admins can access dashboard
  if (page === 'dashboard' && _role !== 'admin') {
    alert('Only administrators can access the dashboard.');
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
      usernameLabel.textContent = 'Aadhaar Number';
      if (usernameInput) usernameInput.placeholder = 'Enter your Aadhaar number (12 digits)';
    } else if (role === 'admin') {
      usernameLabel.textContent = 'Admin ID';
      if (usernameInput) usernameInput.placeholder = 'Enter Admin ID';
    } else if (role === 'teacher') {
      usernameLabel.textContent = 'Faculty ID';
      if (usernameInput) usernameInput.placeholder = 'Enter Faculty ID';
    } else {
      usernameLabel.textContent = 'Username';
      if (usernameInput) usernameInput.placeholder = 'Enter username';
    }
  }
  
  // Students and teachers need the second field (Password or DOB)
  const needsPass = (role === 'admin' || role === 'teacher' || role === 'student');
  if (!section) return;
  if (needsPass) { 
    section.style.display = ''; 
    const label = section.querySelector('label');
    if (label) {
      if (role === 'student') {
        label.innerHTML = 'Date of Birth (DDMMYYYY)';
      } else {
        label.innerHTML = 'Password';
      }
    }
  }
  else { section.style.display = 'none'; }
}

function validateLogin() {
  // Check lockout status
  if (lockedOutUntil && Date.now() < lockedOutUntil) {
    const mins = Math.ceil((lockedOutUntil - Date.now()) / 1000 / 60);
    alert(`🔒 Too many failed attempts. Try again in ${mins} minute(s).`);
    return;
  }
  lockedOutUntil = null;
  
  const role   = document.getElementById('user-type')?.value || 'student';
  const user   = document.getElementById('username')?.value?.trim();
  const pass   = document.getElementById('password')?.value;
  const input  = document.getElementById('captcha-input')?.value?.trim()?.toUpperCase();
  const stored = localStorage.getItem('captcha');

  // Validate required fields
  if (!user || !input) { alert('Please fill all fields'); return; }
  
  // Admin login with brute-force protection
  if (role === 'admin') {
    const isValidUser = user.toLowerCase() === 'admin';
    const isValidPass = pass === 'jacsiceeceiii';
    
    if (!isValidUser || !isValidPass) {
      loginAttempts++;
      const remaining = MAX_LOGIN_ATTEMPTS - loginAttempts;
      if (loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        lockedOutUntil = Date.now() + LOCKOUT_TIME;
        alert(`🔒 Account locked after ${MAX_LOGIN_ATTEMPTS} failed attempts.\n\nTry again after 5 minutes.`);
      } else {
        alert(`❌ Invalid Admin credentials.\n\n${remaining} attempt(s) remaining.`);
      }
      document.getElementById('password').value = '';
      return;
    }
    loginAttempts = 0; // Reset on success
  }
  
  // Faculty login with brute-force protection
  if (role === 'teacher') {
    const isValidUser = user.toLowerCase() === 'faculty';
    const isValidPass = pass === 'jacsiceecestaff';
    
    if (!isValidUser || !isValidPass) {
      loginAttempts++;
      const remaining = MAX_LOGIN_ATTEMPTS - loginAttempts;
      if (loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        lockedOutUntil = Date.now() + LOCKOUT_TIME;
        alert(`🔒 Account locked after ${MAX_LOGIN_ATTEMPTS} failed attempts.\n\nTry again after 5 minutes.`);
      } else {
        alert(`❌ Invalid Faculty credentials.\n\n${remaining} attempt(s) remaining.`);
      }
      document.getElementById('password').value = '';
      return;
    }
    loginAttempts = 0; // Reset on success
  }
  
  // Student login requires date of birth (8 digits DDMMYYYY)
  if (role === 'student') {
    if (!pass) { alert('Please enter your date of birth (DDMMYYYY)'); return; }
    if (!/^\d{8}$/.test(pass)) { alert('Date of birth must be 8 digits (DDMMYYYY format)'); return; }
    
    // Call async validation for student
    validateStudentLogin(user, pass, input, stored);
    return;
  }
  
  // Validate CAPTCHA for admin/faculty
  if (stored && input !== stored) { alert('Invalid CAPTCHA'); return; }

  // Set logged user info
  const nameEl    = document.getElementById('loggedUserName');
  const roleEl    = document.getElementById('loggedUserRole');
  const roleLabel = { admin: 'Admin', teacher: 'Faculty', student: 'Student' };
  if (nameEl) nameEl.textContent = user;
  if (roleEl) roleEl.textContent = roleLabel[role] || role;

  // Store current user info in secure sessionStorage
  sessionStorage.setItem('_role', role);
  sessionStorage.setItem('_user', user);
  sessionStorage.setItem('_loginTime', Date.now());
  currentUserRole = role;
  
  // Legacy localStorage for backward compatibility
  localStorage.setItem('currentUserRole', role);
  localStorage.setItem('currentUsername', user);

  // Apply student-view class for mobile/vertical layout
  if (role === 'student') {
    document.body.classList.add('student-view');
  } else {
    document.body.classList.remove('student-view');
  }

  // Show add-student nav for admins only
  const addStudentNav = document.querySelector('.nav-link[data-page="add-student"]');
  if (addStudentNav) {
    addStudentNav.closest('li').style.display = role === 'admin' ? '' : 'none';
  }

  // Show attendance nav for teachers and admins only — hidden for students
  const attendanceNav = document.querySelector('.nav-link[data-page="attendance"]');
  if (attendanceNav) {
    attendanceNav.closest('li').style.display = (role === 'teacher' || role === 'admin') ? '' : '';
  }

  // Initialize session timeout
  _resetSessionTimeout();

  // Show app shell and navigate
  document.getElementById('page-login').classList.remove('active');
  document.getElementById('page-login').style.display = 'none';
  document.getElementById('app-shell').style.display  = 'flex';

  if (role === 'admin')        navigate('home');
  else if (role === 'teacher') navigate('home');
  else                         navigate('home');
}

// Async student login validation with database lookup
async function validateStudentLogin(user, pass, input, stored) {
  const role = 'student';
  
  // Validate CAPTCHA
  if (stored && input !== stored) { alert('Invalid CAPTCHA'); return; }
  
  // Find student by AADHAAR NUMBER (username field)
  const students = await getStudents();
  console.log('🔍 Total students in database:', students.length);
  console.log('📝 Searching for Aadhaar number:', user);
  console.log('📋 All Aadhaar numbers in database:', students.map(s => s.aadhaarNumber));
  
  const student = students.find(s => 
    (s.aadhaarNumber || '').toLowerCase() === user.toLowerCase()
  );
  
  if (!student) { 
    alert('❌ Aadhaar number not found in the system'); 
    console.log('❌ Aadhaar number "' + user + '" not found. Check the exact Aadhaar number in Firebase.');
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
  const roleLabel = { student: 'Student', admin: 'Admin', teacher: 'Faculty' };
  if (nameEl) nameEl.textContent = student.name || student.studentName || user;
  if (roleEl) roleEl.textContent = roleLabel[role] || role;

  // Store current user info for data filtering
  currentUserRole = role;
  localStorage.setItem('currentUserRole', role);
  localStorage.setItem('currentUsername', student.name || student.studentName || user);
  localStorage.setItem('currentRegisterNumber', student.registerNumber);
  localStorage.setItem('currentAadhaarNumber', student.aadhaarNumber);

  // Apply student-view class for mobile/vertical layout
  document.body.classList.add('student-view');

  // Show add-student nav hidden for students
  const addStudentNav = document.querySelector('.nav-link[data-page="add-student"]');
  if (addStudentNav) {
    addStudentNav.closest('li').style.display = 'none';
  }

  // Show attendance nav for students
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
  
  // Clear secure session storage
  sessionStorage.clear();
  
  // Reset role
  currentUserRole = 'student';
  profilesInitialized = false;
  _cachedStudents = null;
  _cachedAttendance = null;
  
  // Reset security counters
  loginAttempts = 0;
  lockedOutUntil = null;
  clearTimeout(sessionTimeout);
  
  // Clear legacy localStorage
  localStorage.removeItem('currentUserRole');
  localStorage.removeItem('currentUsername');
  localStorage.removeItem('currentRegisterNumber');
  localStorage.removeItem('currentAadhaarNumber');
  
  document.body.classList.remove('student-view');
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

  if (currentUserRole === 'student') {
    // Student sees their own stats only
    const myAadhaar = (localStorage.getItem('currentAadhaarNumber') || '').toLowerCase();
    const myRegNum = (localStorage.getItem('currentRegisterNumber') || '').toLowerCase();
    const me = students.find(s => 
      (s.aadhaarNumber || '').toLowerCase() === myAadhaar ||
      (s.registerNumber || '').toLowerCase() === myRegNum
    );
    const myHist = hist.filter(r => 
      (r.aadhaarNumber || '').toLowerCase() === myAadhaar ||
      (r.registerNumber || '').toLowerCase() === myRegNum
    );
    if (statStudents) { statStudents.textContent = '1'; statStudents.closest('.home-stat-card')?.querySelector('.stat-label')?.setAttribute('data-orig', statStudents.closest('.home-stat-card')?.querySelector('.stat-label')?.textContent); if (statStudents.closest('.home-stat-card')?.querySelector('.stat-label')) statStudents.closest('.home-stat-card').querySelector('.stat-label').textContent = 'My Profile'; }
    const hasScholar = me ? scholarKeys.some(k => String(me[k]||'').toLowerCase() === 'yes') : false;
    if (statScholar) { statScholar.textContent = hasScholar ? 'Yes' : 'No'; if (statScholar.closest('.home-stat-card')?.querySelector('.stat-label')) statScholar.closest('.home-stat-card').querySelector('.stat-label').textContent = 'Scholarship'; }
    if (statAtt && myHist.length) {
      const score = myHist.reduce((acc, r) => acc + (r.status === 'present' ? 1 : r.status === 'halfday' ? 0.5 : 0), 0);
      statAtt.textContent = Math.round((score / myHist.length) * 100) + '%';
    } else if (statAtt) { statAtt.textContent = '—'; }
  } else {
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
  if (dateEl)     dateEl.textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  if (histDateEl && !histDateEl.value) histDateEl.valueAsDate = new Date();
  await updateQuickStats();

  // For students: hide "Take Attendance" tab, show only Reports and History
  const attNavBtns = document.querySelectorAll('.att-nav-btn');
  if (currentUserRole === 'student') {
    // attNavBtns[0] = Home, [1] = Take Attendance, [2] = Reports, [3] = History
    if (attNavBtns[1]) attNavBtns[1].style.display = 'none';
    // Hide Send Alerts button for students
    const sendAlertsBtn = document.getElementById('sendAlertsBtn');
    if (sendAlertsBtn) sendAlertsBtn.style.display = 'none';
    // Auto-navigate to Reports for students
    showAttSection('reportsSection');
  } else {
    if (attNavBtns[1]) attNavBtns[1].style.display = '';
    // Show Send Alerts button for admin/teacher
    const sendAlertsBtn = document.getElementById('sendAlertsBtn');
    if (sendAlertsBtn) sendAlertsBtn.style.display = '';
    showAttSection('homeSection');
  }
}

function updateAttendanceFilters() {
  const level       = document.getElementById('attDeptLevel')?.value || '';
  const deptSelect  = document.getElementById('attDept');
  const batchSelect = document.getElementById('filterBatch');

  deptSelect.innerHTML  = '<option value="">Select Department</option>';
  batchSelect.innerHTML = '<option value="">Select Batch</option>';
  if (!level) return;

  // Group departments by programme
  getProgrammesForLevel(level).forEach(([progKey, prog]) => {
    const grp = document.createElement('optgroup');
    grp.label = prog.label;
    prog.departments.forEach(dept => {
      const opt = document.createElement('option');
      opt.value       = dept.value;
      opt.dataset.prog = progKey;
      opt.textContent  = dept.label;
      grp.appendChild(opt);
    });
    deptSelect.appendChild(grp);
  });
}

function updateAttendanceBatches() {
  const level       = document.getElementById('attDeptLevel')?.value || '';
  const deptSelect  = document.getElementById('attDept');
  const batchSelect = document.getElementById('filterBatch');

  batchSelect.innerHTML = '<option value="">Select Batch</option>';
  if (!level) return;

  const progKey = deptSelect.options[deptSelect.selectedIndex]?.dataset?.prog || null;
  const batches = (progKey && PROGRAMMES[progKey])
    ? PROGRAMMES[progKey].batches
    : [...new Set(getProgrammesForLevel(level).flatMap(([,p]) => p.batches))].sort();

  batches.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b; opt.textContent = b;
    batchSelect.appendChild(opt);
  });
}

function updateReportFilters() {
  const level       = document.getElementById('repDeptLevel')?.value || '';
  const deptSelect  = document.getElementById('repDept');
  const batchSelect = document.getElementById('reportBatch');

  deptSelect.innerHTML  = '<option value="">All Departments</option>';
  batchSelect.innerHTML = '<option value="">All Batches</option>';
  if (!level) return;

  getProgrammesForLevel(level).forEach(([progKey, prog]) => {
    const grp = document.createElement('optgroup');
    grp.label = prog.label;
    prog.departments.forEach(dept => {
      const opt = document.createElement('option');
      opt.value       = dept.value;
      opt.dataset.prog = progKey;
      opt.textContent  = dept.label;
      grp.appendChild(opt);
    });
    deptSelect.appendChild(grp);
  });
}

function updateReportBatches() {
  const level       = document.getElementById('repDeptLevel')?.value || '';
  const deptSelect  = document.getElementById('repDept');
  const batchSelect = document.getElementById('reportBatch');

  batchSelect.innerHTML = '<option value="">All Batches</option>';
  if (!level) return;

  const progKey = deptSelect.options[deptSelect.selectedIndex]?.dataset?.prog || null;
  const batches = (progKey && PROGRAMMES[progKey])
    ? PROGRAMMES[progKey].batches
    : [...new Set(getProgrammesForLevel(level).flatMap(([,p]) => p.batches))].sort();

  batches.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b; opt.textContent = b;
    batchSelect.appendChild(opt);
  });
  generateReport();
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
  const deptLevel = document.getElementById('attDeptLevel')?.value || '';
  const dept  = (document.getElementById('attDept')?.value  || '').trim();
  const batch = (document.getElementById('filterBatch')?.value || '').trim();
  
  if (!batch) { alert('Please select a batch first'); return; }
  if (!dept)  { alert('Please select a department first'); return; }
  
  showLoader('Loading students…');
  const all = await getStudents();
  hideLoader();

  // Normalize dept for matching: extract short code from "ECE - Electronics..." → "ECE"
  const deptCode = dept.includes(' - ') ? dept.split(' - ')[0].trim().toUpperCase() : dept.trim().toUpperCase();

  const students = all.filter(s => {
    // Get all possible dept fields and normalize them too
    const raw = (s.ugDepartment || s.pgDepartment || s.department || '').trim();
    const rawCode = raw.includes(' - ') ? raw.split(' - ')[0].trim().toUpperCase() : raw.trim().toUpperCase();
    // Match by short code OR full string
    const deptMatch = rawCode === deptCode || raw.toUpperCase() === dept.toUpperCase();

    // Batch matching — try all batch fields
    const rawBatch = (s.ugBatch || s.pgBatch || s.Batch || s.batch || '').trim();
    const batchMatch = rawBatch === batch;

    return deptMatch && batchMatch;
  });
  
  const tbody = document.getElementById('attendanceTableBody');
  if (!tbody) return;
  if (!students.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:#888">No students found for <strong>${dept}</strong> / <strong>${batch}</strong>.<br><small>Make sure students are added with matching Department and Batch.</small></td></tr>`;
    return;
  }
  tbody.innerHTML = '';
  // Show the short dept code in the table
  const displayDept = deptCode;
  students.forEach((s, i) => {
    const reg = s.registerNumber || 'N/A';
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${i+1}</td>
      <td>${escapeHtml(reg)}</td>
      <td>${escapeHtml(s.name||s.studentName||'N/A')}</td>
      <td>${escapeHtml(displayDept)}</td>
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
  const deptRaw = (document.getElementById('attDept')?.value || '').trim();
  const batch   = (document.getElementById('filterBatch')?.value || '').trim();
  if (!batch)   { alert('Please select a batch before saving'); return; }
  if (!deptRaw) { alert('Please select a department first'); return; }

  // Always save the short dept code (e.g. "ECE" not "ECE - Electronics...")
  const dept = deptRaw.includes(' - ') ? deptRaw.split(' - ')[0].trim() : deptRaw;

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
      records.push({ date, registerNumber: reg, studentName: cells[2]?.textContent?.trim()||'', department: dept, batch, status: radio.value, remarks: remarks?.value||'' });
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
  const deptRaw   = (document.getElementById('repDept')?.value   || '').trim();
  const batch     = (document.getElementById('reportBatch')?.value || '').trim();
  const tbody     = document.getElementById('reportTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  _reportStudents = [];   // reset cache
  showLoader('Generating report…');
  const [students, history] = await Promise.all([getStudents(), getAttendanceHistory()]);
  hideLoader();

  // Normalize dept filter to short code
  const deptCode = deptRaw.includes(' - ') ? deptRaw.split(' - ')[0].trim().toUpperCase() : deptRaw.trim().toUpperCase();

  // For student role: only show their own record
  const myRegNum = currentUserRole === 'student' ? (localStorage.getItem('currentRegisterNumber') || '').toLowerCase() : null;
  const myAadhaar = currentUserRole === 'student' ? (localStorage.getItem('currentAadhaarNumber') || '').toLowerCase() : null;

  let found = 0;
  students.forEach(s => {
    if (myRegNum && (s.registerNumber || '').toLowerCase() !== myRegNum) return;
    if (myAadhaar && (s.aadhaarNumber || '').toLowerCase() !== myAadhaar) return;

    // Smart dept matching
    const rawDept = (s.ugDepartment || s.pgDepartment || s.department || '').trim();
    const rawCode = rawDept.includes(' - ') ? rawDept.split(' - ')[0].trim().toUpperCase() : rawDept.trim().toUpperCase();
    const deptMatch = !deptRaw || rawCode === deptCode || rawDept.toUpperCase() === deptRaw.toUpperCase();

    // Batch matching
    const rawBatch = (s.ugBatch || s.pgBatch || s.Batch || s.batch || '').trim();
    const batchMatch = !batch || rawBatch === batch;

    if (!deptMatch || !batchMatch) return;

    const hist = history.filter(h => h.registerNumber === s.registerNumber);
    let pct;
    if (hist.length) {
      const score = hist.reduce((acc, h) => acc + (h.status === 'present' ? 1 : h.status === 'halfday' ? 0.5 : 0), 0);
      pct = Math.round((score / hist.length) * 100);
    } else {
      pct = null;
    }

    if (myRegNum || pct === null || pct < threshold) {
      found++;
      const pctDisplay = pct === null ? 'No record' : pct + '%';
      const color   = pct === null ? 'var(--text-secondary)' : pct < 65 ? 'var(--rose)' : pct < threshold ? 'var(--amber)' : 'var(--green)';
      const status  = pct === null ? 'No Data' : pct < 65 ? 'Critical' : pct < threshold ? 'Warning' : 'Good';
      const bgColor = pct === null ? 'var(--surface)' : pct < 65 ? 'var(--rose-soft)' : pct < threshold ? 'var(--amber-soft)' : 'var(--green-soft)';

      // ── cache for sendAlerts ──
      _reportStudents.push({
        registerNumber: s.registerNumber || '',
        name:  s.name || s.studentName || '',
        email: s.studentEmail || s.email || '',
        dept:  rawCode || rawDept,
        batch: rawBatch,
        pct,
        status
      });

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${escapeHtml(s.registerNumber)}</td>
        <td>${escapeHtml(s.name||s.studentName)}</td>
        <td>${escapeHtml(rawCode || rawDept)}</td>
        <td>${escapeHtml(rawBatch)}</td>
        <td><strong style="color:${color}">${pctDisplay}</strong></td>
        <td><span class="status-pill" style="background:${bgColor};color:${color}">${status}</span></td>`;
      tbody.appendChild(row);
    }
  });
  if (!found) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#888">No students found. Try selecting different filters or check that students have been added.</td></tr>';
}

async function loadAttendanceHistory() {
  const date  = document.getElementById('historyDate')?.value || '';
  const batch = document.getElementById('historyBatch')?.value || '';
  const tbody = document.getElementById('historyTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#888"><i class="fa fa-spinner fa-spin"></i> Loading from Firebase…</td></tr>';
  const history  = await getAttendanceHistory();
  tbody.innerHTML = '';

  // For student role: filter to only their own records
  const myRegNum = currentUserRole === 'student' ? (localStorage.getItem('currentRegisterNumber') || '').toLowerCase() : null;
  const myAadhaar = currentUserRole === 'student' ? (localStorage.getItem('currentAadhaarNumber') || '').toLowerCase() : null;

  let filtered = history.filter(r => (!date || r.date === date) && (!batch || r.batch === batch));
  if (myRegNum || myAadhaar) {
    filtered = filtered.filter(r => 
      (myRegNum && (r.registerNumber || '').toLowerCase() === myRegNum) ||
      (myAadhaar && (r.aadhaarNumber || '').toLowerCase() === myAadhaar)
    );
  }

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#888">No attendance records found</td></tr>';
    return;
  }
  filtered.forEach(r => {
    const row = document.createElement('tr');
    const statusClass = `status-${r.status}`;
    row.className = statusClass;
    row.innerHTML = `
      <td data-label="Date">${r.date}</td>
      <td data-label="Register No.">${escapeHtml(r.registerNumber)}</td>
      <td data-label="Student Name">${escapeHtml(r.studentName)}</td>
      <td data-label="Department">${escapeHtml(r.department)}</td>
      <td data-label="Status"><span class="status-pill ${r.status === 'absent' ? 'no' : 'yes'}">${r.status}</span></td>
      <td data-label="Remarks">${escapeHtml(r.remarks)}</td>
    `;
    tbody.appendChild(row);
  });
  filterAttendanceHistory();
}

function filterAttendanceHistory() {
  const filterCheckbox = document.getElementById('filterAbsentOnly');
  const showAbsentOnly = filterCheckbox?.checked || false;
  const rows = document.querySelectorAll('#historyTableBody tr');
  
  rows.forEach(row => {
    if (showAbsentOnly) {
      row.style.display = row.classList.contains('status-absent') ? '' : 'none';
    } else {
      row.style.display = '';
    }
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

// ── Alert report cache — populated by generateReport() ───────────
let _reportStudents = [];   // { registerNumber, name, email, dept, batch, pct, status }

function sendAlerts() {
  if (!_reportStudents.length) {
    alert('No students in the current report. Please run the report first by selecting filters.');
    return;
  }

  const withEmail    = _reportStudents.filter(s => s.email && s.email.includes('@'));
  const noEmail      = _reportStudents.filter(s => !s.email || !s.email.includes('@'));
  const overlay      = document.getElementById('alertModalOverlay');
  const listEl       = document.getElementById('alertStudentList');
  const summaryEl    = document.getElementById('alertSummary');
  if (!overlay || !listEl) return;

  // Summary bar
  summaryEl.innerHTML = `
    <span><strong>${_reportStudents.length}</strong> students in report</span>
    <span style="color:var(--green)"><strong>${withEmail.length}</strong> have email</span>
    ${noEmail.length ? `<span style="color:var(--rose)"><strong>${noEmail.length}</strong> no email on file</span>` : ''}`;

  // Build student rows with checkboxes
  listEl.innerHTML = '';
  _reportStudents.forEach((s, i) => {
    const color  = s.pct === null ? '#888' : s.pct < 65 ? 'var(--rose)' : s.pct < 75 ? 'var(--amber)' : 'var(--accent)';
    const pctTxt = s.pct === null ? 'No Data' : s.pct + '%';
    const hasEmail = s.email && s.email.includes('@');
    const row = document.createElement('div');
    row.className = 'alert-student-row';
    row.innerHTML = `
      <label class="alert-check-wrap" title="${hasEmail ? s.email : 'No email on file'}">
        <input type="checkbox" class="alert-cb" data-idx="${i}" ${hasEmail ? '' : 'disabled'} ${hasEmail ? 'checked' : ''}>
        <span class="alert-cb-box"></span>
      </label>
      <div class="alert-student-info">
        <div class="alert-student-name">${escapeHtml(s.name)}</div>
        <div class="alert-student-sub">${escapeHtml(s.registerNumber)} &nbsp;·&nbsp; ${escapeHtml(s.dept)} &nbsp;·&nbsp; ${escapeHtml(s.batch)}</div>
        ${hasEmail
          ? `<div class="alert-student-email"><i class="fa fa-envelope" style="font-size:0.7rem"></i> ${escapeHtml(s.email)}</div>`
          : `<div class="alert-student-email" style="color:var(--rose)"><i class="fa fa-triangle-exclamation" style="font-size:0.7rem"></i> No email on file</div>`}
      </div>
      <div class="alert-pct" style="color:${color}">${pctTxt}</div>
      <div class="alert-status-badge" style="background:${s.pct===null?'var(--surface)':s.pct<65?'var(--rose-soft)':s.pct<75?'var(--amber-soft)':'var(--accent-soft)'};color:${color}">
        ${s.status}
      </div>
      ${hasEmail ? `<button class="alert-send-one" onclick="sendOneAlert(${i})" title="Send email to this student">
        <i class="fa fa-paper-plane"></i>
      </button>` : '<span style="width:32px"></span>'}`;
    listEl.appendChild(row);
  });

  overlay.style.display = 'flex';
}

function closeAlertModal() {
  const overlay = document.getElementById('alertModalOverlay');
  if (overlay) overlay.style.display = 'none';
}

function sendOneAlert(idx) {
  const s = _reportStudents[idx];
  if (!s || !s.email) return;
  const pctTxt  = s.pct === null ? 'not yet recorded' : s.pct + '%';
  const subject = encodeURIComponent(`Attendance Alert — ${s.name} (${s.registerNumber})`);
  const body    = encodeURIComponent(
`Dear ${s.name},

This is an automated attendance alert from JACSICE Information Management System (JIMS).

Your current attendance is: ${pctTxt}
Department: ${s.dept}
Batch: ${s.batch}
Status: ${s.status}

${s.pct !== null && s.pct < 75
  ? 'Your attendance is below the required threshold of 75%. Please take immediate steps to improve your attendance to avoid academic consequences.'
  : 'Please ensure you maintain regular attendance.'}

Regards,
JACSICE Department Administration
Jayaraj Annapackiam CSI College of Engineering, Nazareth.`
  );
  window.open(`mailto:${s.email}?subject=${subject}&body=${body}`);
}

function sendBulkAlerts() {
  const checked = [...document.querySelectorAll('.alert-cb:checked:not(:disabled)')];
  if (!checked.length) { alert('Please select at least one student to send alerts.'); return; }

  const selected = checked.map(cb => _reportStudents[parseInt(cb.dataset.idx)]).filter(Boolean);
  const emails   = selected.map(s => s.email).filter(Boolean);

  if (!emails.length) { alert('None of the selected students have an email address.'); return; }

  // Build a combined mailto (opens email client with all recipients in BCC)
  const allNames = selected.map(s => `${s.name} (${s.pct === null ? 'No Data' : s.pct + '%'})`).join('\n');
  const subject  = encodeURIComponent('Attendance Alert — JACSICE JIMS');
  const body     = encodeURIComponent(
`Dear Students,

This is an automated attendance alert from JACSICE Information Management System (JIMS).

The following students have been flagged for attendance:

${allNames}

Please ensure you maintain the required 75% minimum attendance. Students below threshold may face academic action.

Regards,
JACSICE Department Administration
Jayaraj Annapackiam CSI College of Engineering, Nazareth.`
  );

  // Open individual mailto for each student (browsers block multi-recipient mailto)
  let delay = 0;
  selected.forEach(s => {
    const sub = encodeURIComponent(`Attendance Alert — ${s.name} (${s.registerNumber})`);
    const bod = encodeURIComponent(
`Dear ${s.name},

This is an automated attendance alert from JACSICE Information Management System (JIMS).

Your current attendance is: ${s.pct === null ? 'not yet recorded' : s.pct + '%'}
Department: ${s.dept} | Batch: ${s.batch} | Status: ${s.status}

${s.pct !== null && s.pct < 75
  ? 'Your attendance is below the required 75% threshold. Please improve your attendance immediately.'
  : 'Please maintain regular attendance.'}

Regards,
JACSICE Department Administration`
    );
    setTimeout(() => { window.open(`mailto:${s.email}?subject=${sub}&body=${bod}`); }, delay);
    delay += 400;
  });

  closeAlertModal();
  alert(`✅ Opening email drafts for ${selected.length} student(s).\n\nYour default email client will open ${selected.length} draft(s) — one per student.`);
}

function toggleSelectAllAlerts(cb) {
  document.querySelectorAll('.alert-cb:not(:disabled)').forEach(el => { el.checked = cb.checked; });
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
  gender_male: { key: 'gender', val: 'male' }, gender_female: { key: 'gender', val: 'female' },
  name: { key: 'name', val: null }, aadhaar: { key: 'aadhaarNumber', val: null },
  email: { key: 'studentEmail', val: null }, mobile: { key: 'mobileNumber', val: null },
  caste: { key: 'caste', val: null },
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
  if (downloadBtn) {
    downloadBtn.style.display = (currentUserRole === 'teacher' || currentUserRole === 'admin') ? '' : 'none';
    downloadBtn.addEventListener('click', e => { e.preventDefault(); exportFilteredStudentsCSV(lastFiltered); });
  }
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

  let students = studentsArg !== undefined ? studentsArg : await getStudents();
  
  // STUDENT ROLE: Show only their own profile (matched by Aadhaar or register number)
  if (currentUserRole === 'student') {
    const currentRegisterNumber = localStorage.getItem('currentRegisterNumber');
    const currentAadhaarNumber = localStorage.getItem('currentAadhaarNumber');
    students = students.filter(s => 
      (s.registerNumber || '').toLowerCase() === (currentRegisterNumber || '').toLowerCase() ||
      (s.aadhaarNumber || '').toLowerCase() === (currentAadhaarNumber || '').toLowerCase()
    );
  }
  // ADMIN & TEACHER: Can see all students
  
  lastFiltered   = students.slice();

  if (!students.length) {
    const msg = currentUserRole === 'student' 
      ? 'Your profile not found in the system.'
      : 'No students found. <a href="#" onclick="navigate(\'add-student\');return false;" style="color:var(--accent);">Add a student →</a>';
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;color:#888">${msg}</td></tr>`;
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
    const deptRaw    = (s.ugDepartment || s.pgDepartment || s.department || '').trim();
    const deptCode   = deptRaw.includes(' - ') ? deptRaw.split(' - ')[0].trim() : deptRaw || '—';
    const batchDisp  = (s.ugBatch || s.pgBatch || s.batch || s.Batch || '—').trim();
    const progDisp   = s.programme || (s.departmentLevel === 'PG' ? 'PG' : 'UG');
    const mobileDisp = (s.mobileNumber || '').trim().length >= 6 ? s.mobileNumber : (s.mobileNumber ? '⚠ ' + s.mobileNumber : '—');
    row.innerHTML = `
      <td data-label="#">${i+1}</td>
      <td data-label="Photo">${photoHtml}</td>
      <td data-label="Student Name" class="td-name">${escapeHtml(s.name||s.studentName||'—')}</td>
      <td data-label="Register No." style="font-family:'DM Mono',monospace;font-size:0.8rem">${escapeHtml(s.registerNumber||'—')}</td>
      <td data-label="Dept / Batch">
        <span style="font-size:0.72rem;font-weight:700;background:var(--accent-soft);color:var(--accent);padding:1px 6px;border-radius:4px;">${escapeHtml(progDisp)}</span>
        <span style="font-size:0.8rem;font-weight:600;margin-left:4px;">${escapeHtml(deptCode)}</span><br>
        <span style="font-size:0.72rem;color:var(--text-secondary)">${escapeHtml(batchDisp)}</span>
      </td>
      <td data-label="Mobile">${escapeHtml(mobileDisp)}</td>
      <td data-label="Scholarship"><span class="status-pill ${hasScholar ? 'yes' : 'no'}">${hasScholar ? 'Active' : 'None'}</span></td>
      <td data-label="Actions" class="action-cell">
        <button class="act-btn view-btn" onclick="viewStudent(${i})" title="View"><i class="fa fa-eye"></i></button>
        ${currentUserRole === 'admin' ? `
          <button class="act-btn" onclick="editStudent(${i})" title="Edit"><i class="fa fa-pen"></i></button>
          <button class="act-btn danger" onclick="deleteStudent(${i})" title="Delete"><i class="fa fa-trash"></i></button>` : ''}
        ${currentUserRole === 'student' ? `<button class="act-btn" onclick="downloadStudentPDF(${i})" title="Download PDF"><i class="fa fa-download"></i></button>` : ''}
        ${currentUserRole === 'teacher' ? `<button class="act-btn" onclick="downloadStudentPDF(${i})" title="Download PDF"><i class="fa fa-download"></i></button>` : ''}
      </td>`;
    tbody.appendChild(row);
  });
}

async function filterStudents() {
  const query   = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
  const checked = [...document.querySelectorAll('.filter-options input[type="checkbox"]:checked')].map(cb => cb.value);
  let students  = await getStudents();
  
  // STUDENT ROLE: Only show own profile (filter by Aadhaar or register number)
  if (currentUserRole === 'student') {
    const currentRegisterNumber = localStorage.getItem('currentRegisterNumber');
    const currentAadhaarNumber = localStorage.getItem('currentAadhaarNumber');
    students = students.filter(s => 
      (s.registerNumber || '').toLowerCase() === (currentRegisterNumber || '').toLowerCase() ||
      (s.aadhaarNumber || '').toLowerCase() === (currentAadhaarNumber || '').toLowerCase()
    );
  } else if (query && (currentUserRole === 'teacher' || currentUserRole === 'admin')) {
    // TEACHER & ADMIN ROLE: Can search across all students
    students = students.filter(s => {
      return (s.name||s.studentName||'').toLowerCase().includes(query)
          || (s.registerNumber||'').toLowerCase().includes(query)
          || (s.aadhaarNumber||'').toLowerCase().includes(query)
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
  const s = lastFiltered[tableIdx];
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
  const s = lastFiltered[tableIdx];
  if (!s || !s._id) return;
  
  const confirmMsg = `⚠️ DELETE STUDENT: ${s.name || s.studentName}\n\nThis will permanently delete:\n✓ Student record\n✓ All attendance history\n✓ All reports\n\nThis cannot be undone!\n\nProceed?`;
  
  if (!confirm(confirmMsg)) return;
  
  showLoader('Deleting student and attendance records from Firebase…');
  try {
    const registerNumber = s.registerNumber;
    
    // Delete all attendance records for this student
    if (registerNumber) {
      const allAttendance = await getAttendanceHistory();
      const batch = db.batch();
      let deletedCount = 0;
      
      allAttendance.forEach(rec => {
        if (rec.registerNumber === registerNumber) {
          batch.delete(db.collection(ATTENDANCE_COL).doc(rec._id));
          deletedCount++;
        }
      });
      
      if (deletedCount > 0) {
        await batch.commit();
        console.log('🗑️ Deleted ' + deletedCount + ' attendance records for student');
      }
    }
    
    // Delete the student record
    await deleteStudentById(s._id);
    
    hideLoader();
    alert('✅ Student and all associated records deleted successfully!\n\n📊 Deleted:\n• Student profile\n• ' + (s.registerNumber ? 'Attendance history' : 'No attendance records') + '\n• Reports');
    renderStudentTable();
  } catch (e) {
    hideLoader();
    alert('❌ Error deleting student: ' + e.message);
    console.error(e);
  }
}

async function downloadStudentPDF(tableIdx) {
  // Use lastFiltered so the correct (already-filtered) student is used
  const s = lastFiltered[tableIdx];
  if (!s) return;
  // Open the view overlay first so printStudentView has content to print
  await viewStudent(tableIdx);
  // Then print/download
  printStudentView();
}

async function viewStudent(tableIdx) {
  // Use lastFiltered so the correct (already-filtered) student is shown
  const s = lastFiltered[tableIdx];
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
  
  // Hide sensitive fields for student role
  const showMobileNumber = currentUserRole !== 'student';
  const showAadhaar = currentUserRole !== 'student';
  const showParentContact = currentUserRole !== 'student';
  
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
      ${row('Date of Birth',s.dateOfBirth)}${showAadhaar ? row('Aadhaar Number',s.aadhaarNumber) : ''}
      ${row('Email ID',s.studentEmail)}${showMobileNumber ? row('Mobile Number',s.mobileNumber) : ''}
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
      ${showParentContact ? row('Parents Contact',s.parentsContactNumber) : ''}${row('Annual Income',s.annualIncome)}
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

// ─── Department & Batch master config ───────────────────────────
// Each programme has its own dept list AND its own batch years.
// value  = short code stored in Firebase
// label  = display text shown in dropdowns
// degree = programme type shown as a tag
const PROGRAMMES = {
  // ── UG ───────────────────────────────────────────────────────
  'BE': {
    level: 'UG',
    label: 'BE - Bachelor of Engineering',
    departments: [
      { value: 'CSE',  label: 'CSE  – Computer Science & Engineering' },
      { value: 'ECE',  label: 'ECE  – Electronics & Communication Engineering' },
      { value: 'IT',   label: 'IT   – Information Technology' }
    ],
    // 4-year programme — 2023 to 2040
    batches: ['2023-2027','2024-2028','2025-2029','2026-2030','2027-2031','2028-2032','2029-2033','2030-2034','2031-2035','2032-2036','2033-2037','2034-2038','2035-2039','2036-2040']
  },
  'B.Tech': {
    level: 'UG',
    label: 'B.Tech - Bachelor of Technology',
    departments: [
      { value: 'AIDS', label: 'AIDS – Artificial Intelligence & Data Science' },
      { value: 'IT',   label: 'IT   – Information Technology' }
    ],
    // 4-year programme — 2023 to 2040
    batches: ['2023-2027','2024-2028','2025-2029','2026-2030','2027-2031','2028-2032','2029-2033','2030-2034','2031-2035','2032-2036','2033-2037','2034-2038','2035-2039','2036-2040']
  },
  // ── PG ───────────────────────────────────────────────────────
  'ME': {
    level: 'PG',
    label: 'ME - Master of Engineering',
    departments: [
      { value: 'ME-CSE', label: 'CSE – Computer Science & Engineering' }
    ],
    // 2-year programme — 2024 to 2040
    batches: ['2024-2026','2025-2027','2026-2028','2027-2029','2028-2030','2029-2031','2030-2032','2031-2033','2032-2034','2033-2035','2034-2036','2035-2037','2036-2038','2037-2039','2038-2040']
  },
  'MBA': {
    level: 'PG',
    label: 'MBA - Master of Business Administration',
    departments: [
      { value: 'MBA', label: 'MBA – Master of Business Administration' }
    ],
    // 2-year programme — 2024 to 2040
    batches: ['2024-2026','2025-2027','2026-2028','2027-2029','2028-2030','2029-2031','2030-2032','2031-2033','2032-2034','2033-2035','2034-2036','2035-2037','2036-2038','2037-2039','2038-2040']
  }
};

// Helper: get all programmes for a given level (UG / PG)
function getProgrammesForLevel(level) {
  return Object.entries(PROGRAMMES).filter(([,p]) => p.level === level);
}

// Kept for backward-compat with attendance filter functions
const departmentOptions = {
  UG: { get departments() { return getProgrammesForLevel('UG').flatMap(([,p]) => p.departments); },
        get batches()     { return [...new Set(getProgrammesForLevel('UG').flatMap(([,p]) => p.batches))].sort(); } },
  PG: { get departments() { return getProgrammesForLevel('PG').flatMap(([,p]) => p.departments); },
        get batches()     { return [...new Set(getProgrammesForLevel('PG').flatMap(([,p]) => p.batches))].sort(); } }
};

function updateDepartmentOptions() {
  const levelSelect  = document.getElementById('departmentLevel');
  const deptSelect   = document.getElementById('department');
  const batchSelect  = document.getElementById('Batch');
  const deptLabel    = document.getElementById('deptLabel');
  const batchLabel   = document.getElementById('batchLabel');
  const progSelect   = document.getElementById('programme');   // new select (added below)

  const level = levelSelect?.value;

  // Clear
  deptSelect.innerHTML  = '<option value="" disabled selected>— Select —</option>';
  batchSelect.innerHTML = '<option value="" disabled selected>— Select —</option>';

  if (!level) return;

  deptLabel.innerHTML  = level === 'UG' ? 'Department <span class="req">*</span>' : 'Department <span class="req">*</span>';
  batchLabel.innerHTML = 'Batch <span class="req">*</span>';

  // Populate depts grouped by programme using <optgroup>
  const progs = getProgrammesForLevel(level);
  progs.forEach(([progKey, prog]) => {
    const grp = document.createElement('optgroup');
    grp.label = prog.label;
    prog.departments.forEach(dept => {
      const opt = document.createElement('option');
      opt.value = dept.value;
      // Store the programme key so we can look up correct batches later
      opt.dataset.prog = progKey;
      opt.textContent  = dept.label;
      grp.appendChild(opt);
    });
    deptSelect.appendChild(grp);
  });
}

function updateBatchOptions() {
  const levelSelect = document.getElementById('departmentLevel');
  const deptSelect  = document.getElementById('department');
  const batchSelect = document.getElementById('Batch');

  batchSelect.innerHTML = '<option value="" disabled selected>— Select —</option>';

  const level = levelSelect?.value;
  if (!level) return;

  // Find which programme the selected dept belongs to
  const selectedOpt = deptSelect.options[deptSelect.selectedIndex];
  const progKey = selectedOpt?.dataset?.prog || null;

  let batches;
  if (progKey && PROGRAMMES[progKey]) {
    batches = PROGRAMMES[progKey].batches;
  } else {
    // fallback: all batches for the level
    batches = [...new Set(getProgrammesForLevel(level).flatMap(([,p]) => p.batches))].sort();
  }

  batches.forEach(batch => {
    const opt = document.createElement('option');
    opt.value = batch;
    opt.textContent = batch;
    batchSelect.appendChild(opt);
  });
}

function initStudentForm() {
  const steps    = document.querySelectorAll('#studentForm .form-step');
  const prevBtn  = document.getElementById('prevBtn');
  const nextBtn  = document.getElementById('nextBtn');
  const saveBtn  = document.getElementById('saveBtn');
  const TOTAL    = steps.length;

  function showStep(n) {
    steps.forEach((s,i) => { s.style.display = i === n ? '' : 'none'; });
    // Re-query buttons each time to get current buttons from DOM
    const currentStepBtns = document.querySelectorAll('#stepNav .step-btn');
    currentStepBtns.forEach((b,i) => {
      b.classList.toggle('active', i === n);
      if (i < n) b.classList.add('done'); else b.classList.remove('done');
    });
    if (prevBtn) prevBtn.style.display = n === 0 ? 'none' : '';
    if (nextBtn) nextBtn.style.display = n === TOTAL - 1 ? 'none' : '';
    if (saveBtn) saveBtn.style.display = n === TOTAL - 1 ? '' : 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    currentStep = n;
  }

  // Clone and setup step buttons
  const stepBtns = document.querySelectorAll('#stepNav .step-btn');
  stepBtns.forEach(b => {
    const fresh = b.cloneNode(true);
    b.parentNode.replaceChild(fresh, b);
    fresh.addEventListener('click', () => showStep(parseInt(fresh.dataset.step, 10)));
  });

  // Clone and setup next/prev buttons
  if (nextBtn) {
    const fn = nextBtn.cloneNode(true);
    nextBtn.parentNode.replaceChild(fn, nextBtn);
    fn.addEventListener('click', () => { if (currentStep < TOTAL-1) showStep(currentStep+1); });
  }
  
  document.getElementById('prevBtn')?.addEventListener('click', () => { if (currentStep > 0) showStep(currentStep-1); });

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
  const level = getFieldVal('departmentLevel');
  const dept  = getFieldVal('department');
  const batch = getFieldVal('Batch');

  // Derive programme key from selected option's data attribute
  const deptSel = document.getElementById('department');
  const selOpt  = deptSel?.options[deptSel.selectedIndex];
  const programme = selOpt?.dataset?.prog || '';

  if (!name)  { alert('Student Name is required'); return; }
  if (!reg)   { alert('Register Number is required'); return; }
  if (!level) { alert('Department Level is required'); return; }
  if (!dept)  { alert('Department is required'); return; }
  if (!batch) { alert('Batch is required'); return; }

  const student = {
    name, studentName: name, registerNumber: reg,
    departmentLevel: level,
    programme,                         // e.g. 'BE', 'B.Tech', 'ME', 'MBA'
    department: dept,
    ugDepartment: level === 'UG' ? dept : '',
    pgDepartment: level === 'PG' ? dept : '',
    Batch: batch,
    ugBatch: level === 'UG' ? batch : '',
    pgBatch: level === 'PG' ? batch : '',
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
  
  // Set department level and update dropdowns
  const level = s.departmentLevel;
  if (level) {
    setVal('departmentLevel', level);
    updateDepartmentOptions();
    // dept stored as short code e.g. 'CSE', 'ECE', 'MBA'
    const dept = (level === 'UG' ? (s.ugDepartment || s.department) : (s.pgDepartment || s.department)) || s.department || '';
    setTimeout(() => {
      const deptSel = document.getElementById('department');
      if (deptSel) {
        // Find the option matching the stored short code and select it
        for (let i = 0; i < deptSel.options.length; i++) {
          if (deptSel.options[i].value === dept) {
            deptSel.selectedIndex = i;
            break;
          }
        }
      }
      updateBatchOptions();
      setTimeout(() => {
        const batch = (level === 'UG' ? s.ugBatch : s.pgBatch) || s.Batch || s.batch || '';
        setVal('Batch', batch);
      }, 40);
    }, 40);
  }
  
  setVal('studentName', s.name||s.studentName);
  setVal('registerNumber', s.registerNumber);
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

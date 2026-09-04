// ============ Apps Script Config ============
// عيّن رابط Google Apps Script هنا بعد deploy
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz2yfpbTOjTS6DfoEykA-bguIeqenscr4fnKoAgBLRiGrNWc07LC89uzcR12-E2sI-9DQ/exec';

// ============ Security Config ============
const SECURITY_CONFIG = {
  salt: 'mathPlatform2024!',
  maxLoginAttempts: 5,
  lockoutDuration: 300000, // 5 minutes in ms
  sessionTimeout: 3600000, // 1 hour in ms
};

// ============ App Constants ============
const STAGES = ['prep1', 'prep2', 'prep3', 'sec1', 'sec2', 'sec3'];

const STAGE_NAMES = {
  prep1: 'الأول الإعدادي', prep2: 'الثاني الإعدادي', prep3: 'الثالث الإعدادي',
  sec1: 'الأول الثانوي', sec2: 'الثاني الثانوي', sec3: 'الثالث الثانوي'
};

const CATEGORIES = ['lectures', 'exercises', 'review'];

const CATEGORY_NAMES = {
  lectures: 'شرح',
  exercises: 'حل تمارين',
  review: 'مراجعة'
};

const CATEGORY_ICONS = {
  lectures: 'fa-chalkboard-teacher',
  exercises: 'fa-pencil-ruler',
  review: 'fa-book-open'
};

// ============ Pagination Config ============
const PAGINATION = {
  contentPerPage: 12,
  studentsPerPage: 20,
  examsPerPage: 10,
};

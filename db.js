// ============ Database (Google Sheets via Apps Script) ============
function createEmptyContent() {
  const c = {};
  STAGES.forEach(s => {
    c[s] = {};
    CATEGORIES.forEach(cat => c[s][cat] = []);
  });
  return c;
}

const DB = {
  teachers: [],
  students: [],
  parents: [],
  content: createEmptyContent(),
  exams: { prep1: [], prep2: [], prep3: [], sec1: [], sec2: [], sec3: [] },
  tracking: {}
};

let currentUser = null;
let examState = { currentExam: null, answers: {}, timeRemaining: 0, timerInterval: null, currentQuestion: 0 };

// ============ Dirty Tracking for Partial Saves ============
const _dirtyFlags = {
  users: false,
  content: false,
  exams: false,
  tracking: false
};

function markDirty(section) {
  if (_dirtyFlags.hasOwnProperty(section)) {
    _dirtyFlags[section] = true;
  }
}

function isDirty(section) {
  return _dirtyFlags[section] === true;
}

function clearDirty(section) {
  if (_dirtyFlags.hasOwnProperty(section)) {
    _dirtyFlags[section] = false;
  }
}

function clearAllDirty() {
  Object.keys(_dirtyFlags).forEach(k => _dirtyFlags[k] = false);
}

// ============ Save Functions ============
let _saveTimeout = null;
let _apiWorking = false;

async function _saveDirtySections() {
  if (!_apiWorking) return true;

  try {
    const promises = [];

    if (isDirty('users')) {
      promises.push(API.saveUsers(DB.teachers, DB.students, DB.parents).then(() => clearDirty('users')));
    }
    if (isDirty('content')) {
      promises.push(API.saveContent(DB.content).then(() => clearDirty('content')));
    }
    if (isDirty('exams')) {
      promises.push(API.saveExams(DB.exams).then(() => clearDirty('exams')));
    }
    if (isDirty('tracking')) {
      promises.push(API.saveTracking(DB.tracking).then(() => clearDirty('tracking')));
    }

    if (promises.length > 0) {
      await Promise.all(promises);
      console.log('Saved sections:', promises.length);
    }

    return true;
  } catch (e) {
    console.error('Error saving to API:', e);
    return false;
  }
}

window.saveDB = function (section = null) {
  if (!_apiWorking) return Promise.resolve(true);

  // Mark specific section or all as dirty
  if (section) {
    markDirty(section);
  } else {
    Object.keys(_dirtyFlags).forEach(k => markDirty(k));
  }

  clearTimeout(_saveTimeout);
  _saveTimeout = setTimeout(async () => {
    await _saveDirtySections();
  }, 800);

  return Promise.resolve(true);
};

window.saveDBSync = async function () {
  if (!_apiWorking) return true;

  clearTimeout(_saveTimeout);
  Object.keys(_dirtyFlags).forEach(k => markDirty(k));

  try {
    await _saveDirtySections();
    return true;
  } catch (e) {
    console.error('Error in sync save:', e);
    return false;
  }
};

// ============ Content Migration ============
function migrateContent(oldContent) {
  if (!oldContent) return createEmptyContent();
  const newContent = createEmptyContent();
  STAGES.forEach(s => {
    if (Array.isArray(oldContent[s])) {
      oldContent[s].forEach(item => {
        item.category = item.category || 'lectures';
        if (!newContent[s][item.category]) newContent[s][item.category] = [];
        newContent[s][item.category].push(item);
      });
    } else if (oldContent[s] && typeof oldContent[s] === 'object') {
      CATEGORIES.forEach(cat => {
        if (Array.isArray(oldContent[s][cat])) {
          newContent[s][cat] = oldContent[s][cat];
        }
      });
    }
  });
  return newContent;
}

// ============ Content Helpers ============
function getAllStageItems(stageId) {
  const items = [];
  const stageContent = DB.content[stageId];
  if (!stageContent) return items;
  CATEGORIES.forEach(cat => {
    (stageContent[cat] || []).forEach(item => {
      items.push({ ...item, stageId, category: cat });
    });
  });
  return items;
}

function getAllContentItems() {
  const items = [];
  STAGES.forEach(s => {
    getAllStageItems(s).forEach(item => items.push(item));
  });
  return items;
}

function findItem(stageId, id) {
  const stageContent = DB.content[stageId];
  if (!stageContent) return null;
  for (const cat of CATEGORIES) {
    const item = (stageContent[cat] || []).find(c => c.id === id);
    if (item) return { item, category: cat };
  }
  return null;
}

function findItemGlobal(id) {
  for (const s of STAGES) {
    const found = findItem(s, id);
    if (found) return { ...found, stageId: s };
  }
  return null;
}

function removeItem(stageId, id) {
  const stageContent = DB.content[stageId];
  if (!stageContent) return false;
  for (const cat of CATEGORIES) {
    const idx = (stageContent[cat] || []).findIndex(c => c.id === id);
    if (idx !== -1) {
      stageContent[cat].splice(idx, 1);
      return true;
    }
  }
  return false;
}

function getLinkedStudent() {
  if (currentUser.role !== 'parent' || !currentUser.studentId) return null;
  return DB.students.find(s => s.id === currentUser.studentId) || null;
}

function getEffectiveUser() {
  if (currentUser.role === 'parent') {
    const student = getLinkedStudent();
    if (student) return student;
  }
  return currentUser;
}

// ============ Load from API ============
async function loadDBFromAPI() {
  try {
    console.log('Testing API connection to:', APPS_SCRIPT_URL);
    const result = await API.testConnection();
    console.log('API test result:', result);

    if (!result.ok) {
      console.error('API connection failed:', result.error);
      _apiWorking = false;
      return false;
    }

    const data = result.data;
    DB.teachers = data.teachers || [];
    DB.students = data.students || [];
    DB.parents = data.parents || [];
    DB.content = data.content ? migrateContent(data.content) : createEmptyContent();
    DB.exams = data.exams || { prep1: [], prep2: [], prep3: [], sec1: [], sec2: [], sec3: [] };
    DB.tracking = data.tracking || {};

    _apiWorking = true;
    console.log('API connected successfully. Teachers:', DB.teachers.length, 'Students:', DB.students.length);
    return true;
  } catch (e) {
    console.error("API not available:", e.message);
    _apiWorking = false;
    return false;
  }
}

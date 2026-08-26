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

let _saveTimeout = null;
let _pendingSave = null;
let _apiWorking = false;

function _saveToLocalStorage() {
  try {
    const data = { teachers: DB.teachers, students: DB.students, parents: DB.parents, content: DB.content, exams: DB.exams, tracking: DB.tracking };
    localStorage.setItem('mathPlatformDB', JSON.stringify(data));
  } catch (e) { /* ignore */ }
}

function _loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem('mathPlatformDB');
    if (!raw) return false;
    const data = JSON.parse(raw);
    DB.teachers = data.teachers || [];
    DB.students = data.students || [];
    DB.parents = data.parents || [];
    DB.content = data.content ? migrateContent(data.content) : createEmptyContent();
    DB.exams = data.exams || { prep1: [], prep2: [], prep3: [], sec1: [], sec2: [], sec3: [] };
    DB.tracking = data.tracking || {};
    return true;
  } catch (e) { return false; }
}

window.saveDB = function () {
  _saveToLocalStorage();
  if (!_apiWorking) return Promise.resolve(true);

  clearTimeout(_saveTimeout);
  _pendingSave = new Promise((resolve) => {
    _saveTimeout = setTimeout(async () => {
      try {
        console.log('Saving to API...');
        await API.saveUsers(DB.teachers, DB.students, DB.parents);
        await API.saveContent(DB.content);
        await API.saveExams(DB.exams);
        await API.saveTracking(DB.tracking);
        console.log('Save successful');
        resolve(true);
      } catch (e) {
        console.error('Error saving DB:', e);
        resolve(false);
      }
    }, 500);
  });
  return _pendingSave;
};

window.saveDBSync = async function () {
  _saveToLocalStorage();
  if (!_apiWorking) return true;

  clearTimeout(_saveTimeout);
  try {
    console.log('Saving to API (sync)...');
    await API.saveUsers(DB.teachers, DB.students, DB.parents);
    await API.saveContent(DB.content);
    await API.saveExams(DB.exams);
    await API.saveTracking(DB.tracking);
    console.log('Save successful');
    return true;
  } catch (e) {
    console.error('Error saving DB:', e);
    return false;
  }
};

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

async function loadDBFromAPI() {
  try {
    console.log('Testing API connection...');
    const data = await API.getAllData();
    console.log('API response:', data);

    if (!data) throw new Error('لا توجد بيانات من الخادم');
    if (data.error) throw new Error(data.error);
    if (data.raw && !data.teachers) throw new Error('الاستجابة ليست JSON صالح');

    DB.teachers = data.teachers || [];
    DB.students = data.students || [];
    DB.parents = data.parents || [];
    DB.content = data.content ? migrateContent(data.content) : createEmptyContent();
    DB.exams = data.exams || { prep1: [], prep2: [], prep3: [], sec1: [], sec2: [], sec3: [] };
    DB.tracking = data.tracking || {};

    _apiWorking = true;
    console.log('API connected. Teachers:', DB.teachers.length);
    return true;
  } catch (e) {
    console.error("API not available:", e.message);
    _apiWorking = false;
    console.log('Trying localStorage fallback...');
    const loaded = _loadFromLocalStorage();
    if (loaded) {
      console.log('Loaded from localStorage. Teachers:', DB.teachers.length);
    } else {
      console.log('No localStorage data either. Starting empty.');
    }
    return false;
  }
}

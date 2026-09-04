const SPREADSHEET_ID = '1nW-VURklxh3KM2YI1Q8WMxaXefNBpmDsErisaZrlWWw';

// ============ Input Validation ============
const Validators = {
  isValidId(id) {
    return id && typeof id === 'string' && id.length <= 50 && /^[a-zA-Z0-9_-]+$/.test(id);
  },

  isValidUsername(username) {
    return username && typeof username === 'string' && username.length >= 2 && username.length <= 50;
  },

  isValidPassword(password) {
    return password && typeof password === 'string' && password.length >= 4 && password.length <= 256;
  },

  isValidName(name) {
    return name && typeof name === 'string' && name.length >= 1 && name.length <= 100;
  },

  isValidStage(stageId) {
    return ['prep1', 'prep2', 'prep3', 'sec1', 'sec2', 'sec3'].includes(stageId);
  },

  isValidCategory(category) {
    return ['lectures', 'exercises', 'review'].includes(category);
  },

  isValidType(type) {
    return ['video', 'pdf', 'file'].includes(type);
  },

  sanitizeString(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>]/g, '').substring(0, 1000);
  },

  sanitizeNumber(num, min, max) {
    const n = parseInt(num);
    if (isNaN(n)) return min;
    return Math.max(min, Math.min(max, n));
  }
};

function doGet(e) {
  try {
    const paramStr = e.parameter.p;
    if (!paramStr) return jsonResponse({ error: 'No parameters' });

    let body;
    try {
      body = JSON.parse(decodeURIComponent(paramStr));
    } catch (parseErr) {
      return jsonResponse({ error: 'Invalid JSON parameters' });
    }

    const action = body.action;
    if (!action || typeof action !== 'string') {
      return jsonResponse({ error: 'Invalid action' });
    }

    let result;

    switch (action) {
      case 'getAllData':
        result = getAllData();
        break;
      case 'saveUsers':
        result = saveUsers(body);
        break;
      case 'saveContent':
        result = saveContent(body);
        break;
      case 'saveExams':
        result = saveExams(body);
        break;
      case 'saveTracking':
        result = saveTracking(body);
        break;
      case 'deleteFile':
        result = deleteFile(body);
        break;
      default:
        result = { error: 'Unknown action: ' + action };
    }

    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: 'Server error: ' + err.message });
  }
}

function doPost(e) {
  try {
    let body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return jsonResponse({ error: 'Invalid JSON body' });
    }

    const action = body.action;
    if (!action || typeof action !== 'string') {
      return jsonResponse({ error: 'Invalid action' });
    }

    let result;

    switch (action) {
      case 'saveUsers':
        result = saveUsers(body);
        break;
      case 'saveContent':
        result = saveContent(body);
        break;
      case 'saveExams':
        result = saveExams(body);
        break;
      case 'saveTracking':
        result = saveTracking(body);
        break;
      case 'uploadFile':
        result = uploadFile(body);
        break;
      case 'deleteFile':
        result = deleteFile(body);
        break;
      default:
        result = { error: 'Unknown POST action: ' + action };
    }

    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: 'Server error: ' + err.message });
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    // Style header row
    sheet.getRange(1, 1, 1, headers.length).setBackground('#c9a84c').setFontColor('#ffffff').setFontWeight('bold');
  }
  return sheet;
}

function getSheet(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheetConfigs = {
    'Users': ['id', 'type', 'username', 'password', 'name', 'grade', 'studentId', 'createdAt'],
    'Content': ['id', 'stageId', 'category', 'title', 'description', 'type', 'videoId', 'url', 'fileUrl', 'fileName', 'fileSize', 'publicId', 'date'],
    'Exams': ['id', 'stageId', 'title', 'description', 'duration', 'questions', 'createdAt'],
    'Tracking': ['studentId', 'studentName', 'grade', 'completedLessons', 'videoProgress', 'examScores']
  };
  return getOrCreateSheet(ss, name, sheetConfigs[name] || []);
}

function clearSheet(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow > 1 && lastCol > 0) {
    sheet.getRange(2, 1, lastRow - 1, lastCol).clearContent();
  }
}

function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const allEmpty = data[i].every(function(cell) { return cell === '' || cell === null; });
    if (allEmpty) continue;
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j] !== null ? data[i][j] : '';
    }
    rows.push(obj);
  }
  return rows;
}

function objectsToSheet(sheet, headers, rows) {
  clearSheet(sheet);
  if (rows.length === 0) return;
  const values = [];
  for (let i = 0; i < rows.length; i++) {
    const row = [];
    for (let j = 0; j < headers.length; j++) {
      const val = rows[i][headers[j]];
      row.push(val === undefined || val === null ? '' : String(val));
    }
    values.push(row);
  }
  if (values.length > 0) {
    sheet.getRange(2, 1, values.length, headers.length).setValues(values);
  }
}

function getAllData() {
  const usersSheet = getSheet('Users');
  const contentSheet = getSheet('Content');
  const examsSheet = getSheet('Exams');
  const trackingSheet = getSheet('Tracking');

  const users = sheetToObjects(usersSheet);
  const teachers = [];
  const students = [];
  const parents = [];

  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    if (u.type === 'teacher') teachers.push(u);
    else if (u.type === 'student') students.push(u);
    else if (u.type === 'parent') parents.push(u);
  }

  const rawContent = sheetToObjects(contentSheet);
  const content = {};
  for (let i = 0; i < rawContent.length; i++) {
    const c = rawContent[i];
    const stage = c.stageId || '';
    const cat = c.category || 'lectures';
    if (!stage) continue;
    if (!content[stage]) content[stage] = { lectures: [], exercises: [], review: [] };
    if (!content[stage][cat]) content[stage][cat] = [];
    content[stage][cat].push(c);
  }

  const rawExams = sheetToObjects(examsSheet);
  const exams = {};
  for (let i = 0; i < rawExams.length; i++) {
    const ex = rawExams[i];
    const stage = ex.stageId || '';
    if (!stage) continue;
    if (!exams[stage]) exams[stage] = [];
    try { ex.questions = JSON.parse(ex.questions || '[]'); } catch (e) { ex.questions = []; }
    exams[stage].push(ex);
  }

  const rawTracking = sheetToObjects(trackingSheet);
  const tracking = {};
  for (let i = 0; i < rawTracking.length; i++) {
    const t = rawTracking[i];
    const sid = t.studentId || '';
    if (!sid) continue;
    try { t.completedLessons = JSON.parse(t.completedLessons || '[]'); } catch (e) { t.completedLessons = []; }
    try { t.videoProgress = JSON.parse(t.videoProgress || '{}'); } catch (e) { t.videoProgress = {}; }
    try { t.examScores = JSON.parse(t.examScores || '{}'); } catch (e) { t.examScores = {}; }
    tracking[sid] = t;
  }

  return { teachers, students, parents, content, exams, tracking };
}

function saveUsers(body) {
  const sheet = getSheet('Users');
  const headers = ['id', 'type', 'username', 'password', 'name', 'grade', 'studentId', 'createdAt'];
  const rows = [];

  const teachers = body.teachers || [];
  const students = body.students || [];
  const parents = body.parents || [];

  // Validate and sanitize teachers
  for (let i = 0; i < teachers.length; i++) {
    const t = teachers[i];
    if (!Validators.isValidId(t.id)) continue;
    rows.push({
      id: t.id,
      type: 'teacher',
      username: Validators.sanitizeString(t.username),
      password: Validators.sanitizeString(t.password),
      name: Validators.sanitizeString(t.name),
      grade: '',
      studentId: '',
      createdAt: Validators.sanitizeString(t.createdAt)
    });
  }

  // Validate and sanitize students
  for (let i = 0; i < students.length; i++) {
    const s = students[i];
    if (!Validators.isValidId(s.id)) continue;
    rows.push({
      id: s.id,
      type: 'student',
      username: Validators.sanitizeString(s.username),
      password: Validators.sanitizeString(s.password),
      name: Validators.sanitizeString(s.name),
      grade: Validators.isValidStage(s.grade) ? s.grade : '',
      studentId: '',
      createdAt: Validators.sanitizeString(s.createdAt)
    });
  }

  // Validate and sanitize parents
  for (let i = 0; i < parents.length; i++) {
    const p = parents[i];
    if (!Validators.isValidId(p.id)) continue;
    rows.push({
      id: p.id,
      type: 'parent',
      username: Validators.sanitizeString(p.username),
      password: Validators.sanitizeString(p.password),
      name: Validators.sanitizeString(p.name),
      grade: '',
      studentId: Validators.isValidId(p.studentId) ? p.studentId : '',
      createdAt: Validators.sanitizeString(p.createdAt)
    });
  }

  objectsToSheet(sheet, headers, rows);
  return { success: true, count: rows.length };
}

function saveContent(body) {
  const sheet = getSheet('Content');
  const headers = ['id', 'stageId', 'category', 'title', 'description', 'type', 'videoId', 'url', 'fileUrl', 'fileName', 'fileSize', 'publicId', 'date'];
  const rows = [];

  const data = body.content || {};
  const stages = Object.keys(data);
  for (let s = 0; s < stages.length; s++) {
    const stageId = stages[s];
    if (!Validators.isValidStage(stageId)) continue;
    const stageData = data[stageId];
    if (!stageData) continue;
    const categories = Object.keys(stageData);
    for (let c = 0; c < categories.length; c++) {
      const category = categories[c];
      if (!Validators.isValidCategory(category)) continue;
      const items = stageData[category] || [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!Validators.isValidId(item.id)) continue;
        rows.push({
          id: item.id,
          stageId: stageId,
          category: category,
          title: Validators.sanitizeString(item.title),
          description: Validators.sanitizeString(item.description),
          type: Validators.isValidType(item.type) ? item.type : '',
          videoId: Validators.sanitizeString(item.videoId),
          url: Validators.sanitizeString(item.url),
          fileUrl: Validators.sanitizeString(item.fileUrl),
          fileName: Validators.sanitizeString(item.fileName),
          fileSize: Validators.sanitizeNumber(item.fileSize, 0, 999999999),
          publicId: Validators.sanitizeString(item.publicId),
          date: Validators.sanitizeString(item.date)
        });
      }
    }
  }

  objectsToSheet(sheet, headers, rows);
  return { success: true, count: rows.length };
}

function saveExams(body) {
  const sheet = getSheet('Exams');
  const headers = ['id', 'stageId', 'title', 'description', 'duration', 'questions', 'createdAt'];
  const rows = [];

  const data = body.exams || {};
  const stages = Object.keys(data);
  for (let s = 0; s < stages.length; s++) {
    const stageId = stages[s];
    if (!Validators.isValidStage(stageId)) continue;
    const examsList = data[stageId] || [];
    for (let i = 0; i < examsList.length; i++) {
      const ex = examsList[i];
      if (!Validators.isValidId(ex.id)) continue;
      // Limit questions to prevent abuse
      const questions = Array.isArray(ex.questions) ? ex.questions.slice(0, 100) : [];
      rows.push({
        id: ex.id,
        stageId: stageId,
        title: Validators.sanitizeString(ex.title),
        description: Validators.sanitizeString(ex.description),
        duration: Validators.sanitizeNumber(ex.duration, 5, 300),
        questions: JSON.stringify(questions),
        createdAt: Validators.sanitizeString(ex.createdAt)
      });
    }
  }

  objectsToSheet(sheet, headers, rows);
  return { success: true, count: rows.length };
}

function saveTracking(body) {
  const sheet = getSheet('Tracking');
  const headers = ['studentId', 'studentName', 'grade', 'completedLessons', 'videoProgress', 'examScores'];
  const rows = [];

  const data = body.tracking || {};
  const studentIds = Object.keys(data);
  for (let i = 0; i < studentIds.length; i++) {
    const sid = studentIds[i];
    if (!Validators.isValidId(sid)) continue;
    const t = data[sid];
    // Limit arrays to prevent abuse
    const completedLessons = Array.isArray(t.completedLessons) ? t.completedLessons.slice(0, 1000) : [];
    const videoProgress = typeof t.videoProgress === 'object' ? t.videoProgress : {};
    const examScores = typeof t.examScores === 'object' ? t.examScores : {};

    rows.push({
      studentId: sid,
      studentName: Validators.sanitizeString(t.studentName),
      grade: Validators.isValidStage(t.grade) ? t.grade : '',
      completedLessons: JSON.stringify(completedLessons),
      videoProgress: JSON.stringify(videoProgress),
      examScores: JSON.stringify(examScores)
    });
  }

  objectsToSheet(sheet, headers, rows);
  return { success: true, count: rows.length };
}

function getOrCreateFolder(name) {
  const folders = DriveApp.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(name);
}

function getStageFolder(stageId) {
  const root = getOrCreateFolder('MathPlatform');
  const folders = root.getFoldersByName(stageId);
  if (folders.hasNext()) return folders.next();
  return root.createFolder(stageId);
}

function uploadFile(body) {
  try {
    const base64 = body.base64Data;
    const fileName = body.fileName || 'file';
    const stageId = body.stageId || 'general';

    if (!base64 || typeof base64 !== 'string') {
      return { error: 'Invalid file data' };
    }

    // Limit file size (base64 encoded, roughly 200MB limit)
    if (base64.length > 280000000) {
      return { error: 'File too large (max 200MB)' };
    }

    const ext = fileName.split('.').pop().toLowerCase();
    const mimeMap = {
      'pdf': 'application/pdf',
      'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'gif': 'image/gif',
      'doc': 'application/msword', 'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'ppt': 'application/vnd.ms-powerpoint', 'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'xls': 'application/vnd.ms-excel', 'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'mp4': 'video/mp4', 'webm': 'video/webm',
      'zip': 'application/zip', 'rar': 'application/x-rar-compressed'
    };
    const mimeType = mimeMap[ext] || 'application/octet-stream';

    const folder = getStageFolder(stageId);
    const decoded = Utilities.base64Decode(base64);
    const blob = Utilities.newBlob(decoded, mimeType, fileName);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const fileId = file.getId();
    const viewUrl = 'https://drive.google.com/file/d/' + fileId + '/view';

    return { success: true, url: viewUrl, publicId: fileId, size: file.getSize(), format: ext };
  } catch (err) {
    return { error: 'Upload failed: ' + err.message };
  }
}

function deleteFile(body) {
  try {
    const fileId = body.fileId || body.publicId;
    if (!fileId || typeof fileId !== 'string') {
      return { error: 'Invalid file ID' };
    }
    // Validate file ID format
    if (!/^[a-zA-Z0-9_-]+$/.test(fileId) || fileId.length > 100) {
      return { error: 'Invalid file ID format' };
    }
    DriveApp.getFileById(fileId).setTrashed(true);
    return { success: true };
  } catch (err) {
    return { error: 'Delete failed: ' + err.message };
  }
}

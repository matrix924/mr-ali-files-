const SPREADSHEET_ID = '1nW-VURklxh3KM2YI1Q8WMxaXefNBpmDsErisaZrlWWw';

function doGet(e) {
  try {
    const paramStr = e.parameter.p;
    if (!paramStr) return jsonResponse({ error: 'No parameters' });

    const body = JSON.parse(decodeURIComponent(paramStr));
    const action = body.action;
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
    return jsonResponse({ error: err.message });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    let result;

    switch (action) {
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
    return jsonResponse({ error: err.message });
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

  for (let i = 0; i < teachers.length; i++) {
    const t = teachers[i];
    rows.push({ id: t.id||'', type: 'teacher', username: t.username||'', password: t.password||'', name: t.name||'', grade: t.grade||'', studentId: t.studentId||'', createdAt: t.createdAt||'' });
  }
  for (let i = 0; i < students.length; i++) {
    const s = students[i];
    rows.push({ id: s.id||'', type: 'student', username: s.username||'', password: s.password||'', name: s.name||'', grade: s.grade||'', studentId: s.studentId||'', createdAt: s.createdAt||'' });
  }
  for (let i = 0; i < parents.length; i++) {
    const p = parents[i];
    rows.push({ id: p.id||'', type: 'parent', username: p.username||'', password: p.password||'', name: p.name||'', grade: p.grade||'', studentId: p.studentId||'', createdAt: p.createdAt||'' });
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
    const stageData = data[stageId];
    if (!stageData) continue;
    const categories = Object.keys(stageData);
    for (let c = 0; c < categories.length; c++) {
      const category = categories[c];
      const items = stageData[category] || [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        rows.push({ id: item.id||'', stageId, category, title: item.title||'', description: item.description||'', type: item.type||'', videoId: item.videoId||'', url: item.url||'', fileUrl: item.fileUrl||'', fileName: item.fileName||'', fileSize: item.fileSize||'', publicId: item.publicId||'', date: item.date||'' });
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
    const examsList = data[stageId] || [];
    for (let i = 0; i < examsList.length; i++) {
      const ex = examsList[i];
      rows.push({ id: ex.id||'', stageId, title: ex.title||'', description: ex.description||'', duration: ex.duration||'', questions: JSON.stringify(ex.questions||[]), createdAt: ex.createdAt||'' });
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
    const t = data[sid];
    rows.push({ studentId: sid, studentName: t.studentName||'', grade: t.grade||'', completedLessons: JSON.stringify(t.completedLessons||[]), videoProgress: JSON.stringify(t.videoProgress||{}), examScores: JSON.stringify(t.examScores||{}) });
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
    return { error: err.message };
  }
}

function deleteFile(body) {
  try {
    const fileId = body.fileId || body.publicId;
    if (!fileId) return { error: 'No file ID provided' };
    DriveApp.getFileById(fileId).setTrashed(true);
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
}

// ============ Students Management (Teacher) ============
let _studentsPage = 1;

function loadStudentsManager() {
  _studentsPage = 1;
  document.getElementById('dashboardContent').innerHTML = `
    <h2 style="color: var(--gold); margin-bottom: 25px;">
      <i class="fas fa-users"></i> إدارة الطلاب
    </h2>
    <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;">
      <button class="btn btn-gold" onclick="addStudent()"><i class="fas fa-user-plus"></i> إضافة طالب</button>
    </div>
    <div class="search-bar">
      <input type="text" class="form-control" placeholder="بحث بالاسم أو الصف..." id="studentSearch" oninput="_studentsPage=1;renderStudentsTable()">
      <select class="form-control" style="max-width:200px;" id="studentFilter" onchange="_studentsPage=1;renderStudentsTable()">
        <option value="all">جميع الصفوف</option>
        ${STAGES.map(s => `<option value="${s}">${getStageName(s)}</option>`).join('')}
      </select>
    </div>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>الاسم</th>
            <th>الصف</th>
            <th>المستخدم</th>
            <th>ولي الأمر</th>
            <th>إجراءات</th>
          </tr>
        </thead>
        <tbody id="studentsTableBody"></tbody>
      </table>
    </div>
    <div id="studentsPagination"></div>
  `;
  renderStudentsTable();
}

function renderStudentsTable() {
  const search = (document.getElementById('studentSearch')?.value || '').toLowerCase();
  const filter = document.getElementById('studentFilter')?.value || 'all';
  const tbody = document.getElementById('studentsTableBody');
  if (!tbody) return;

  let students = DB.students;
  if (filter !== 'all') students = students.filter(st => st.grade === filter);
  if (search) students = students.filter(st => st.name.toLowerCase().includes(search) || getStageName(st.grade).includes(search));

  // Paginate
  const pagination = paginate(students, _studentsPage, PAGINATION.studentsPerPage);

  if (pagination.items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-secondary);">لا يوجد طلاب</td></tr>';
    renderPagination('studentsPagination', pagination, 'goToStudentsPage');
    return;
  }

  const startIndex = (pagination.currentPage - 1) * PAGINATION.studentsPerPage;

  tbody.innerHTML = pagination.items.map((s, i) => {
    const p = DB.parents.find(pr => pr.studentId === s.id);
    return `
      <tr>
        <td>${startIndex + i + 1}</td>
        <td><strong>${Security.escapeHtml(s.name)}</strong></td>
        <td><span class="badge">${getStageName(s.grade)}</span></td>
        <td><code style="background:var(--input-bg);padding:3px 8px;border-radius:5px;">${Security.escapeHtml(s.username)}</code></td>
        <td>${p ? Security.escapeHtml(p.name) : '<span style="color:var(--text-secondary);">-</span>'}</td>
        <td>
          <button class="btn btn-sm btn-info" onclick="viewCred('${s.id}')" title="عرض بيانات الدخول">
            <i class="fas fa-key"></i>
          </button>
          <button class="btn btn-sm btn-success" onclick="viewStudentTracking('${s.id}')" title="عرض التقدم">
            <i class="fas fa-chart-line"></i>
          </button>
          <button class="btn btn-sm btn-danger" onclick="confirmDeleteStudent('${s.id}')" title="حذف">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  renderPagination('studentsPagination', pagination, 'goToStudentsPage');
}

function goToStudentsPage(page) {
  _studentsPage = page;
  renderStudentsTable();
}

function addStudent() {
  showModal('إضافة طالب جديد', `
    <div class="form-group">
      <label>اسم الطالب</label>
      <input class="form-control" id="sName" placeholder="اسم الطالب بالعربي">
    </div>
    <div class="form-group">
      <label>الصف الدراسي</label>
      <select class="form-control" id="sGrade">
        ${STAGES.map(s => `<option value="${s}">${getStageName(s)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>اسم ولي الأمر</label>
      <input class="form-control" id="pName" placeholder="اسم ولي الأمر">
    </div>
    <button class="btn btn-gold btn-block" onclick="genAccounts()"><i class="fas fa-magic"></i> توليد الحسابات</button>
    <div id="genResult" style="margin-top:20px;"></div>
  `);
}

async function genAccounts() {
  const sn = document.getElementById('sName').value.trim();
  const sg = document.getElementById('sGrade').value;
  const pn = document.getElementById('pName').value.trim();

  if (!validateField(sn, 'اسم الطالب', 2)) return;
  if (!validateField(pn, 'اسم ولي الأمر', 2)) return;

  let su, pu;
  do { su = Security.generateUsername(sn, 'student'); } while (DB.students.some(st => st.username === su));
  do { pu = Security.generateUsername(pn, 'parent'); } while (DB.parents.some(p => p.username === pu));

  const sp = Security.generatePassword();
  const pp = Security.generatePassword();
  const sid = Security.generateId('s');
  const pid = Security.generateId('p');

  const hashedStudentPass = await Security.hashPassword(sp);
  const hashedParentPass = await Security.hashPassword(pp);

  DB.students.push({
    id: sid, username: su, password: hashedStudentPass,
    name: sn, grade: sg, role: 'student',
    createdAt: new Date().toISOString()
  });
  DB.parents.push({
    id: pid, username: pu, password: hashedParentPass,
    name: pn, studentId: sid, role: 'parent',
    createdAt: new Date().toISOString()
  });
  DB.tracking[sid] = {
    studentId: sid, studentName: sn, grade: sg,
    completedLessons: [], videoProgress: {}, examScores: {}
  };
  saveDB('users');
  saveDB('tracking');

  document.getElementById('genResult').innerHTML = `
      <div style="background:var(--input-bg);padding:20px;border-radius:15px;border:2px solid var(--success);">
      <h4 style="color:var(--success);margin-bottom:15px;"><i class="fas fa-check-circle"></i> تم الإنشاء بنجاح!</h4>
      <div style="background:var(--input-bg);padding:12px;border-radius:8px;margin-bottom:10px;font-family:monospace;line-height:2;border:1px solid var(--border-color);">
        <strong style="color:var(--gold);">🎓 الطالب:</strong><br>
        <span>المستخدم: ${Security.escapeHtml(su)}</span><br>
        <span>كلمة المرور: ${Security.escapeHtml(sp)}</span>
      </div>
      <div style="background:var(--input-bg);padding:12px;border-radius:8px;font-family:monospace;line-height:2;border:1px solid var(--border-color);">
        <strong style="color:var(--gold);">👨‍👧 ولي الأمر:</strong><br>
        <span>المستخدم: ${Security.escapeHtml(pu)}</span><br>
        <span>كلمة المرور: ${Security.escapeHtml(pp)}</span>
      </div>
      <div style="display:flex;gap:10px;margin-top:12px;">
        <button class="btn btn-info" style="flex:1;" onclick="copyCredentials('${Security.escapeHtml(su)}','${Security.escapeHtml(sp)}')">
          <i class="fas fa-copy"></i> نسخ بيانات الطالب
        </button>
        <button class="btn btn-info" style="flex:1;" onclick="copyCredentials('${Security.escapeHtml(pu)}','${Security.escapeHtml(pp)}')">
          <i class="fas fa-copy"></i> نسخ بيانات ولي الأمر
        </button>
      </div>
      <button class="btn btn-success btn-block" style="margin-top:8px;" onclick="copyAllCredentials('${Security.escapeHtml(su)}','${Security.escapeHtml(sp)}','${Security.escapeHtml(sn)}','${Security.escapeHtml(pu)}','${Security.escapeHtml(pp)}','${Security.escapeHtml(pn)}')">
        <i class="fas fa-copy"></i> نسخ كل البيانات
      </button>
      <p style="color:var(--danger);margin-top:10px;font-weight:bold;">
        <i class="fas fa-exclamation-triangle"></i> انسخ البيانات الآن! لا يمكن استرجاعها لاحقاً.
      </p>
    </div>
  `;
  showToast('تم إنشاء الحسابات بنجاح!');
}

function viewCred(sid) {
  const s = DB.students.find(st => st.id === sid);
  if (!s) return;
  const p = DB.parents.find(pr => pr.studentId === sid);
  showModal('بيانات الدخول', `
    <div style="text-align:center;margin-bottom:20px;">
      <div class="avatar" style="width:60px;height:60px;font-size:1.5rem;margin:0 auto 10px;">${s.name.charAt(0)}</div>
      <h3 style="color:var(--gold);">${Security.escapeHtml(s.name)}</h3>
      <p style="color:var(--text-secondary);">${getStageName(s.grade)}</p>
    </div>
    <div style="background:var(--input-bg);padding:15px;border-radius:10px;font-family:monospace;line-height:2;border:1px solid var(--border-color);margin-bottom:10px;">
      <strong style="color:var(--gold);">🎓 الطالب:</strong><br>
      <p><strong>المستخدم:</strong> ${Security.escapeHtml(s.username)}</p>
      <p><strong>كلمة المرور (SHA-256):</strong> ${Security.escapeHtml(s.password)}</p>
    </div>
    ${p ? `
    <div style="background:var(--input-bg);padding:15px;border-radius:10px;font-family:monospace;line-height:2;border:1px solid var(--border-color);margin-bottom:10px;">
      <strong style="color:var(--gold);">👨‍👧 ولي الأمر:</strong><br>
      <p><strong>المستخدم:</strong> ${Security.escapeHtml(p.username)}</p>
      <p><strong>كلمة المرور (SHA-256):</strong> ${Security.escapeHtml(p.password)}</p>
    </div>
    ` : ''}
    <div style="display:flex;gap:10px;margin-top:15px;">
      <button class="btn btn-info" style="flex:1;" onclick="copyCredentials('${Security.escapeHtml(s.username)}','${Security.escapeHtml(s.password)}')">
        <i class="fas fa-copy"></i> نسخ بيانات الطالب
      </button>
      ${p ? `
      <button class="btn btn-info" style="flex:1;" onclick="copyCredentials('${Security.escapeHtml(p.username)}','${Security.escapeHtml(p.password)}')">
        <i class="fas fa-copy"></i> نسخ بيانات ولي الأمر
      </button>
      ` : ''}
    </div>
    ${p ? `
    <button class="btn btn-success btn-block" style="margin-top:8px;" onclick="copyAllCredentials('${Security.escapeHtml(s.username)}','${Security.escapeHtml(s.password)}','${Security.escapeHtml(s.name)}','${Security.escapeHtml(p.username)}','${Security.escapeHtml(p.password)}','${Security.escapeHtml(p.name)}')">
      <i class="fas fa-copy"></i> نسخ كل البيانات
    </button>
    ` : ''}
  `);
}

function copyCredentials(user, pass) {
  copyToClipboard(`المستخدم: ${user}\nكلمة المرور: ${pass}`);
}

function copyAllCredentials(sUser, sPass, sName, pUser, pPass, pName) {
  const text = `بيانات حسابات المنصة\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🎓 الطالب: ${sName}\n` +
    `المستخدم: ${sUser}\n` +
    `كلمة المرور: ${sPass}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👨‍👧 ولي الأمر: ${pName}\n` +
    `المستخدم: ${pUser}\n` +
    `كلمة المرور: ${pPass}\n` +
    `━━━━━━━━━━━━━━━━━━━━`;
  copyToClipboard(text, 'تم نسخ كل البيانات!');
}

function viewStudentTracking(sid) {
  const s = DB.students.find(st => st.id === sid);
  if (!s) return;
  currentUser._tempViewStudent = s;
  navigate('tracking');
}

function confirmDeleteStudent(sid) {
  const studentToDelete = DB.students.find(st => st.id === sid);
  if (!studentToDelete) return;
  showConfirm(`هل أنت متأكد من حذف الطالب "${studentToDelete.name}" وولي أمره؟`, () => {
    delStudent(sid);
  });
}

function delStudent(sid) {
  const parentToDelete = DB.parents.find(pr => pr.studentId === sid);
  DB.students = DB.students.filter(st => st.id !== sid);
  if (parentToDelete) DB.parents = DB.parents.filter(pr => pr.id !== parentToDelete.id);
  delete DB.tracking[sid];
  saveDB('users');
  saveDB('tracking');
  renderStudentsTable();
  showToast('تم الحذف');
}

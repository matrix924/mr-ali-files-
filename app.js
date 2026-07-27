
const firebaseConfig = {
    apiKey: "AIzaSyB0aU5Yc_3z4ue50_q8VScsOxJWe8ysEgc",
    authDomain: "mr-ali-3cd16.firebaseapp.com",
    projectId: "mr-ali-3cd16",
    storageBucket: "mr-ali-3cd16.firebasestorage.app",
    messagingSenderId: "555917613912",
    appId: "1:555917613912:web:685b7cff219463a8f1232d",
    measurementId: "G-CX0B8HGRM4"
};


let db = null;
try {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
} catch(e) {
  console.error("Firebase init error:", e);
}

const CLOUDINARY = {
  cloudName: 'wo7mpha2',
  uploadPreset: 'math_platform',
  apiKey: '326681788423652',
  apiSecret: 'PLZQw_kX2KGvCsesLuUXlkNZkFQ'
};

async function uploadToCloudinary(file, stage) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY.uploadPreset);
  formData.append('folder', `math-platform/${stage}`);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/auto/upload`,
    { method: 'POST', body: formData }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'فشل رفع الملف');
  }

  const data = await response.json();
  return {
    url: data.secure_url,
    publicId: data.public_id,
    size: data.bytes,
    format: data.format
  };
}

async function deleteFromCloudinary(publicId) {
  if (!publicId) return false;
  const auth = 'Basic ' + btoa(CLOUDINARY.apiKey + ':' + CLOUDINARY.apiSecret);
  const types = ['image', 'raw', 'video'];
  for (const type of types) {
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/resources/${type}/destroy`, {
        method: 'POST',
        headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_id: publicId })
      });
      const data = await res.json();
      console.log(`Cloudinary delete (${type}):`, publicId, data);
      if (data.result === 'ok') return true;
    } catch(e) {
      console.error(`Cloudinary delete error (${type}):`, e);
    }
  }
  return false;
}

function extractPublicIdFromUrl(fileUrl) {
  if (!fileUrl || !fileUrl.includes('cloudinary.com')) return null;
  try {
    const parts = fileUrl.split('/');
    const uploadIdx = parts.indexOf('upload');
    if (uploadIdx === -1) return null;
    const afterUpload = parts.slice(uploadIdx + 1);
    if (afterUpload[0] && afterUpload[0].match(/^v\d+$/)) afterUpload.shift();
    let publicId = afterUpload.join('/');
    publicId = publicId.replace(/\.[^.]+$/, '');
    return publicId;
  } catch(e) { return null; }
}

    // ============ Security Helpers ============
    const Security = {
      escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
      },

      hashPassword(password) {
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
          const char = password.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash;
        }
        return 'h_' + Math.abs(hash).toString(36);
      }
    };

    // ============ Database ============
    const STAGES = ['prep1','prep2','prep3','sec1','sec2','sec3'];
    const STAGE_NAMES = {
      prep1: 'الأول الإعدادي', prep2: 'الثاني الإعدادي', prep3: 'الثالث الإعدادي',
      sec1: 'الأول الثانوي', sec2: 'الثاني الثانوي', sec3: 'الثالث الثانوي'
    };

    
    const DB = {
      teachers: [],
      students: [],
      parents: [],
      content: {"prep1":[],"prep2":[],"prep3":[],"sec1":[],"sec2":[],"sec3":[]},
      exams: {"prep1":[],"prep2":[],"prep3":[],"sec1":[],"sec2":[],"sec3":[]},
      tracking: {}
    };

    let currentUser = null;
    let examState = { currentExam: null, answers: {}, timeRemaining: 0, timerInterval: null, currentQuestion: 0 };

    window.saveDB = async function() {
      try {
        await db.collection('platform').doc('users').set({ teachers: DB.teachers, students: DB.students, parents: DB.parents });
        await db.collection('platform').doc('content').set(DB.content);
        await db.collection('platform').doc('exams').set(DB.exams);
        await db.collection('platform').doc('tracking').set(DB.tracking);
      } catch (e) {
        console.error('Error saving DB:', e);
        showToast('خطأ في حفظ البيانات: ' + e.message, 'error');
      }
    };


    // ============ Utility Functions ============
    function showToast(msg, type = 'success') {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.style.background = type === 'success' ? 'var(--success)' : 'var(--danger)';
      t.style.color = 'white';
      t.style.display = 'block';
      clearTimeout(t._timeout);
      t._timeout = setTimeout(() => t.style.display = 'none', 3000);
    }

    function showModal(title, content) {
      document.getElementById('modalContent').innerHTML = `
        <div class="modal-header">
          <h3>${Security.escapeHtml(title)}</h3>
          <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        ${content}
      `;
      document.getElementById('generalModal').classList.add('show');
    }

    function closeModal() {
      document.getElementById('generalModal').classList.remove('show');
    }

    function getStageName(id) {
      return STAGE_NAMES[id] || id;
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

    function formatSize(bytes) {
      if (!bytes) return '';
      const s = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + s[i];
    }

    function formatTime(seconds) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    function formatDate(dateStr) {
      if (!dateStr) return '';
      return new Date(dateStr).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    function fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    function extractYouTubeId(url) {
      const patterns = [
        /(?:youtube\.com\/watch\?v=)([^&\s]+)/,
        /(?:youtu\.be\/)([^?\s]+)/,
        /(?:youtube\.com\/embed\/)([^?\s]+)/,
        /(?:youtube\.com\/shorts\/)([^?\s]+)/
      ];
      for (const p of patterns) {
        const m = url.match(p);
        if (m) return m[1];
      }
      return null;
    }

    function generatePassword(l = 12) {
      const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
      let p = '';
      for (let i = 0; i < l; i++) p += c[Math.floor(Math.random() * c.length)];
      return p;
    }

    function generateUsername(name, role) {
      const map = {
        'أحمد': 'Ahmed', 'محمد': 'Mohamed', 'علي': 'Ali', 'عمر': 'Omar',
        'سارة': 'Sara', 'مريم': 'Maryam', 'نور': 'Noor', 'خالد': 'Khaled',
        'فاطمة': 'Fatma', 'يوسف': 'Youssef', 'إبراهيم': 'Ibrahim',
        'حسن': 'Hassan', 'محمود': 'Mahmoud', 'عبدالله': 'Abdullah',
        'أميرة': 'Amira', 'منى': 'Mona'
      };
      const en = map[name] || name.replace(/[^a-zA-Z\u0600-\u06FF]/g, '').substring(0, 6) || 'User';
      const prefix = role === 'student' ? 'STU' : 'PRT';
      return `${prefix}_${en}_${Math.floor(Math.random() * 9999)}${Date.now().toString().slice(-4)}`.replace(/[^a-zA-Z0-9_]/g, '');
    }

    function validateField(value, fieldName, minLength = 1) {
      if (!value || value.trim().length < minLength) {
        showToast(`يجب إدخال ${fieldName} (${minLength} أحرف على الأقل)`, 'error');
        return false;
      }
      return true;
    }

    function validateEmail(email) {
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return re.test(email);
    }

    // ============ Auth ============
    function initDefaultTeacher() {
      if (!DB.teachers.length) {
        const hashedPass = Security.hashPassword('Ali@33');
        DB.teachers.push({ id: 't1', username: 'Ali@33', password: hashedPass, name: 'أستاذ علي' });
        saveDB();
      }
    }

    function login() {
      const role = document.getElementById('loginRole').value;
      const username = document.getElementById('loginUsername').value.trim();
      const password = document.getElementById('loginPassword').value.trim();

      // Clear previous errors
      document.getElementById('usernameError').style.display = 'none';
      document.getElementById('passwordError').style.display = 'none';
      document.getElementById('loginError').style.display = 'none';
      document.getElementById('loginUsername').classList.remove('error');
      document.getElementById('loginPassword').classList.remove('error');

      let hasError = false;

      if (!username) {
        document.getElementById('usernameError').textContent = 'يجب إدخال اسم المستخدم';
        document.getElementById('usernameError').style.display = 'block';
        document.getElementById('loginUsername').classList.add('error');
        hasError = true;
      }

      if (!password) {
        document.getElementById('passwordError').textContent = 'يجب إدخال كلمة المرور';
        document.getElementById('passwordError').style.display = 'block';
        document.getElementById('loginPassword').classList.add('error');
        hasError = true;
      }

      if (hasError) return;

      let user = null;
      const hashedPassword = Security.hashPassword(password);

      const matchPassword = (stored, input) => stored === input || stored === hashedPassword;

      if (role === 'teacher') {
        user = DB.teachers.find(u => u.username === username && matchPassword(u.password, password));
        if (user && user.password === password) { user.password = hashedPassword; saveDB(); }
      } else if (role === 'student') {
        user = DB.students.find(u => u.username === username && matchPassword(u.password, password));
        if (user && user.password === password) { user.password = hashedPassword; saveDB(); }
      } else {
        user = DB.parents.find(u => u.username === username && matchPassword(u.password, password));
        if (user && user.password === password) { user.password = hashedPassword; saveDB(); }
      }

      if (user) {
        currentUser = { ...user, role };
        document.getElementById('userAvatar').textContent = user.name.charAt(0);
        document.getElementById('userName').textContent = user.name;
        document.getElementById('authPage').style.display = 'none';
        document.getElementById('dashboardPage').style.display = 'block';
        document.getElementById('navbar').style.display = 'flex';
        buildSidebar();
        navigate('overview');
        showToast(`مرحباً ${user.name}!`);
        document.getElementById('loginUsername').value = '';
        document.getElementById('loginPassword').value = '';
      } else {
        document.getElementById('loginError').textContent = 'بيانات الدخول غير صحيحة';
        document.getElementById('loginError').style.display = 'block';
      }
    }

    function logout() {
      if (examState.timerInterval) clearInterval(examState.timerInterval);
      currentUser = null;
      examState = { currentExam: null, answers: {}, timeRemaining: 0, timerInterval: null, currentQuestion: 0 };
      document.getElementById('authPage').style.display = 'flex';
      document.getElementById('dashboardPage').style.display = 'none';
      document.getElementById('navbar').style.display = 'none';
      document.getElementById('examModal').classList.remove('show');
    }

    // ============ Sidebar ============
    function buildSidebar() {
      const menu = document.getElementById('sidebarMenu');
      const isTeacher = currentUser.role === 'teacher';
      const isParent = currentUser.role === 'parent';

      const items = [
        { section: 'overview', icon: 'fa-home', label: 'الرئيسية', show: true },
        { section: 'content', icon: 'fa-book-open', label: isParent ? 'المحتوى التعليمي' : 'المحتوى التعليمي', show: true },
        { section: 'exams', icon: 'fa-file-alt', label: isParent ? 'امتحانات ابنك' : 'الامتحانات', show: true },
        { section: 'students', icon: 'fa-users', label: 'الطلاب', show: isTeacher },
        { section: 'tracking', icon: 'fa-chart-line', label: 'المتابعة', show: isTeacher },
        { section: 'progress', icon: 'fa-chart-bar', label: isParent ? 'تقدم ابنك' : 'تقدمي', show: !isTeacher },
        { section: 'myexams', icon: 'fa-pen-fancy', label: isParent ? 'امتحانات ابنك' : 'امتحاناتي', show: !isTeacher },
      ];

      menu.innerHTML = items
        .filter(i => i.show)
        .map(i => `<li><a data-section="${i.section}"><i class="fas ${i.icon}"></i> ${i.label}</a></li>`)
        .join('');

      menu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', e => {
          e.preventDefault();
          navigate(link.dataset.section);
          if (window.innerWidth <= 1024) toggleSidebar();
        });
      });
    }

    function toggleSidebar() {
      document.getElementById('sidebar').classList.toggle('open');
      document.getElementById('sidebarOverlay').classList.toggle('show');
    }

    function navigate(section) {
      loadSection(section);
      document.querySelectorAll('#sidebarMenu a').forEach(a => a.classList.remove('active'));
      const link = document.querySelector(`#sidebarMenu a[data-section="${section}"]`);
      if (link) link.classList.add('active');
    }

    function loadSection(section) {
      if (!currentUser) return;

      const teacherRoutes = {
        overview: loadOverview,
        content: loadContentManager,
        exams: loadExamsManager,
        students: loadStudentsManager,
        tracking: loadTracking,
      };

      const studentParentRoutes = {
        overview: loadOverview,
        content: loadStudentContentView,
        exams: loadStudentExamsView,
        progress: loadStudentProgress,
        myexams: loadStudentMyExams,
      };

      const routes = currentUser.role === 'teacher' ? teacherRoutes : studentParentRoutes;
      const handler = routes[section];

      if (handler) {
        handler();
      } else {
        document.getElementById('dashboardContent').innerHTML = `
          <div class="empty-state">
            <i class="fas fa-construction"></i>
            <p>هذا القسم غير متاح حالياً</p>
          </div>
        `;
      }
    }

    // ============ Overview ============
    function loadOverview() {
      let totalContent = 0, totalExams = 0;
      Object.values(DB.content).forEach(a => totalContent += a.length);
      Object.values(DB.exams).forEach(a => totalExams += a.length);

      const isTeacher = currentUser.role === 'teacher';
      const isParent = currentUser.role === 'parent';
      const linkedStudent = isParent ? getLinkedStudent() : null;
      const effectiveGrade = linkedStudent ? linkedStudent.grade : currentUser.grade;

      document.getElementById('dashboardContent').innerHTML = `
        <h2 style="color: var(--gold); margin-bottom: 25px;">
          <i class="fas fa-tachometer-alt"></i> ${isTeacher ? 'لوحة التحكم' : 'مرحباً بك'}
        </h2>
        ${!isTeacher ? `
          <div style="background:var(--input-bg);border-radius:15px;padding:25px;border:1px solid var(--gold);margin-bottom:25px;">
            <h3 style="color:var(--gold);margin-bottom:10px;">
              <i class="fas fa-user"></i> ${Security.escapeHtml(currentUser.name)}
            </h3>
            <p style="color:var(--text-secondary);">
              ${isParent ?
                `ولي أمر الطالب: ${linkedStudent ? Security.escapeHtml(linkedStudent.name) : 'غير مرتبط'} ${linkedStudent ? `- ${getStageName(linkedStudent.grade)}` : ''}` :
                `الصف: ${getStageName(currentUser.grade)}`
              }
            </p>
          </div>
        ` : ''}
        <div class="stats-grid">
          ${isTeacher ? `
            <div class="stat-card">
              <div class="stat-value">${DB.students.length}</div>
              <div class="stat-label"><i class="fas fa-user-graduate"></i> طالب</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${totalContent}</div>
              <div class="stat-label"><i class="fas fa-book-open"></i> محتوى</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${totalExams}</div>
              <div class="stat-label"><i class="fas fa-file-alt"></i> امتحان</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${DB.parents.length}</div>
              <div class="stat-label"><i class="fas fa-user-friends"></i> ولي أمر</div>
            </div>
          ` : `
            <div class="stat-card">
              <div class="stat-value">${(DB.content[effectiveGrade] || []).length}</div>
              <div class="stat-label"><i class="fas fa-book-open"></i> محتوى متاح</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${(DB.exams[effectiveGrade] || []).length}</div>
              <div class="stat-label"><i class="fas fa-file-alt"></i> امتحان متاح</div>
            </div>
            ${isParent && linkedStudent ? (() => {
              const tracking = DB.tracking[linkedStudent.id] || { examScores: {}, completedLessons: [] };
              const scores = Object.values(tracking.examScores);
              const avg = scores.length > 0 ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0;
              const total = (DB.content[linkedStudent.grade] || []).length;
              const done = tracking.completedLessons.length;
              return `
                <div class="stat-card">
                  <div class="stat-value">${done}/${total}</div>
                  <div class="stat-label"><i class="fas fa-check-circle"></i> الدروس المكتملة</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">${avg}%</div>
                  <div class="stat-label"><i class="fas fa-star"></i> متوسط الدرجات</div>
                </div>
              `;
            })() : ''}
          `}
        </div>
        ${isTeacher ? `
          <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;">
            <button class="btn btn-outline btn-sm" onclick="showBackupModal()">
              <i class="fas fa-database"></i> نسخ احتياطي
            </button>
          </div>
        ` : ''}
      `;
    }

    // ============ Content Management (Teacher) ============
    function getContentCountByStage() {
      const counts = {};
      STAGES.forEach(s => counts[s] = (DB.content[s] || []).length);
      counts.all = Object.values(counts).reduce((a, b) => a + b, 0);
      return counts;
    }

    function loadContentManager() {
      const counts = getContentCountByStage();
      document.getElementById('dashboardContent').innerHTML = `
        <h2 style="color: var(--gold); margin-bottom: 25px;">
          <i class="fas fa-book-open"></i> إدارة المحتوى
          <span class="badge" style="font-size:0.9rem;margin-right:10px;">${counts.all} محتوى</span>
        </h2>
        <div style="display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap;">
          <button class="btn btn-gold" onclick="addVideo()"><i class="fab fa-youtube"></i> فيديو يوتيوب</button>
          <button class="btn btn-info" onclick="uploadPDF()"><i class="fas fa-file-pdf"></i> مذكرة PDF</button>
          <button class="btn btn-outline" onclick="uploadFile()"><i class="fas fa-cloud-upload-alt"></i> رفع ملف</button>
        </div>
        <div class="tabs" id="stageTabs">
          <button class="tab-btn active" data-stage="all">الكل (${counts.all})</button>
          ${STAGES.map(s => `<button class="tab-btn" data-stage="${s}">${getStageName(s)} (${counts[s]})</button>`).join('')}
        </div>
        <div class="tabs" id="typeTabs" style="margin-bottom:15px;">
          <button class="tab-btn active" data-type="all">الكل</button>
          <button class="tab-btn" data-type="video"><i class="fab fa-youtube"></i> فيديوهات</button>
          <button class="tab-btn" data-type="pdf"><i class="fas fa-file-pdf"></i> PDF</button>
          <button class="tab-btn" data-type="file"><i class="fas fa-file"></i> ملفات</button>
        </div>
        <div class="search-bar">
          <input type="text" class="form-control" placeholder="بحث في العنوان أو الوصف..." id="contentSearch" oninput="renderContent()">
        </div>
        <div class="lesson-grid" id="contentGrid"></div>
      `;

      document.querySelectorAll('#stageTabs .tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          document.querySelectorAll('#stageTabs .tab-btn').forEach(b => b.classList.remove('active'));
          this.classList.add('active');
          renderContent();
        });
      });

      document.querySelectorAll('#typeTabs .tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          document.querySelectorAll('#typeTabs .tab-btn').forEach(b => b.classList.remove('active'));
          this.classList.add('active');
          renderContent();
        });
      });

      renderContent();
    }

    function renderContent() {
      const activeStage = document.querySelector('#stageTabs .tab-btn.active')?.dataset?.stage || 'all';
      const activeType = document.querySelector('#typeTabs .tab-btn.active')?.dataset?.type || 'all';
      const searchQuery = (document.getElementById('contentSearch')?.value || '').toLowerCase();
      let items = [];

      if (activeStage === 'all') {
        Object.entries(DB.content).forEach(([stageId, arr]) => {
          arr.forEach(item => items.push({ ...item, stageId }));
        });
      } else {
        (DB.content[activeStage] || []).forEach(item => items.push({ ...item, stageId: activeStage }));
      }

      if (activeType !== 'all') {
        items = items.filter(i => i.type === activeType);
      }

      if (searchQuery) {
        items = items.filter(i =>
          i.title.toLowerCase().includes(searchQuery) ||
          (i.description || '').toLowerCase().includes(searchQuery)
        );
      }

      const grid = document.getElementById('contentGrid');
      if (!grid) return;

      if (items.length === 0) {
        grid.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-inbox"></i>
            <p>لا يوجد محتوى${searchQuery ? ' يطابق البحث' : ''}</p>
          </div>
        `;
        return;
      }

      grid.innerHTML = items.map(item => {
        let icon = '', badgeClass = '', badgeText = '';
        if (item.type === 'video') {
          icon = '<i class="fab fa-youtube" style="color:#f00;font-size:2.5rem;"></i>';
          badgeClass = 'badge-danger';
          badgeText = 'فيديو';
        } else if (item.type === 'pdf') {
          icon = '<i class="fas fa-file-pdf" style="color:#f44;font-size:2.5rem;"></i>';
          badgeClass = 'badge-danger';
          badgeText = 'PDF';
        } else {
          icon = '<i class="fas fa-file" style="color:#2196f3;font-size:2.5rem;"></i>';
          badgeClass = 'badge-info';
          badgeText = 'ملف';
        }

        const thumbHtml = item.type === 'video' && item.videoId ?
          `<div style="margin-bottom:12px;border-radius:10px;overflow:hidden;position:relative;">
            <img src="https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg" alt="${Security.escapeHtml(item.title)}"
              style="width:100%;height:160px;object-fit:cover;display:block;" onerror="this.parentElement.innerHTML='<div style=\\'height:160px;display:flex;align-items:center;justify-content:center;background:var(--input-bg);\\'>'+this.alt+'</div>'">
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.6);width:50px;height:50px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;" onclick="playVideo('${item.videoId}','${Security.escapeHtml(item.title).replace(/'/g, "\\'")}')">
              <i class="fas fa-play" style="color:#fff;font-size:1.2rem;margin-right:-3px;"></i>
            </div>
          </div>` : '';

        return `
          <div class="content-card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <span class="badge ${badgeClass}">${badgeText}</span>
              <span style="font-size:0.75rem;color:var(--text-secondary);">${formatDate(item.date)}</span>
            </div>
            ${thumbHtml}
            ${!thumbHtml ? `<div style="text-align:center;margin:15px 0;">${icon}</div>` : ''}
            <h4>${Security.escapeHtml(item.title)}</h4>
            <p style="color:var(--text-secondary);font-size:0.9rem;">${Security.escapeHtml(item.description || '')}</p>
            <p style="font-size:0.8rem;color:var(--text-secondary);margin-top:8px;">
              <i class="fas fa-graduation-cap"></i> ${getStageName(item.stageId || stageId)}
            </p>
            ${item.fileSize ? `
              <p style="font-size:0.8rem;color:var(--text-secondary);">
                <i class="fas fa-weight-hanging"></i> ${formatSize(item.fileSize)} |
                <i class="fas fa-file"></i> ${Security.escapeHtml(item.fileName || '')}
              </p>
            ` : ''}
            <div style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap;">
              ${item.type === 'video' ?
                `<button class="btn btn-sm btn-info" onclick="playVideo('${item.videoId}','${Security.escapeHtml(item.title).replace(/'/g, "\\'")}')"><i class="fas fa-play"></i> تشغيل</button>` :
                `<button class="btn btn-sm btn-info" onclick="downloadItem('${item.stageId}','${item.id}')"><i class="fas fa-download"></i> تحميل</button>`
              }
              <button class="btn btn-sm btn-outline" onclick="editContentItem('${item.stageId}','${item.id}')"><i class="fas fa-edit"></i> تعديل</button>
              <button class="btn btn-sm btn-danger" onclick="deleteItem('${item.stageId}','${item.id}')"><i class="fas fa-trash"></i> حذف</button>
            </div>
          </div>
        `;
      }).join('');
    }

    function editContentItem(stageId, id) {
      const item = (DB.content[stageId] || []).find(c => c.id === id);
      if (!item) return;

      const isVideo = item.type === 'video';
      showModal('تعديل المحتوى', `
        <div class="form-group">
          <label>الصف الدراسي</label>
          <select class="form-control" id="editStage">
            ${STAGES.map(s => `<option value="${s}" ${s === stageId ? 'selected' : ''}>${getStageName(s)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>العنوان</label>
          <input class="form-control" id="editTitle" value="${Security.escapeHtml(item.title)}">
        </div>
        ${isVideo ? `
          <div class="form-group">
            <label>رابط يوتيوب</label>
            <input class="form-control" id="editUrl" value="${Security.escapeHtml(item.url || '')}">
          </div>
        ` : ''}
        <div class="form-group">
          <label>الوصف</label>
          <textarea class="form-control" id="editDesc">${Security.escapeHtml(item.description || '')}</textarea>
        </div>
        <button class="btn btn-gold btn-block" onclick="saveEditContent('${stageId}','${id}','${item.type}')">
          <i class="fas fa-save"></i> حفظ التعديلات
        </button>
      `);
    }

    function saveEditContent(oldStageId, id, type) {
      const newStage = document.getElementById('editStage').value;
      const newTitle = document.getElementById('editTitle').value.trim();
      const newDesc = document.getElementById('editDesc').value.trim();

      if (!validateField(newTitle, 'العنوان', 3)) return;

      const itemIndex = (DB.content[oldStageId] || []).findIndex(c => c.id === id);
      if (itemIndex === -1) return;

      const item = DB.content[oldStageId][itemIndex];
      item.title = newTitle;
      item.description = newDesc;

      if (type === 'video') {
        const newUrl = document.getElementById('editUrl').value.trim();
        if (newUrl) {
          const vid = extractYouTubeId(newUrl);
          if (!vid) { showToast('رابط يوتيوب غير صالح', 'error'); return; }
          item.url = newUrl;
          item.videoId = vid;
        }
      }

      if (newStage !== oldStageId) {
        DB.content[oldStageId].splice(itemIndex, 1);
        if (!DB.content[newStage]) DB.content[newStage] = [];
        item.stageId = newStage;
        DB.content[newStage].push(item);
      }

      saveDB();
      closeModal();
      renderContent();
      showToast('تم التعديل بنجاح!');
    }

    function addVideo() {
      showModal('إضافة فيديو يوتيوب', `
        <div class="form-group">
          <label>الصف الدراسي</label>
          <select class="form-control" id="vStage">
            ${STAGES.map(s => `<option value="${s}">${getStageName(s)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>عنوان الفيديو</label>
          <input class="form-control" id="vTitle" placeholder="مثال: حل المعادلات التربيعية">
        </div>
        <div class="form-group">
          <label>رابط يوتيوب</label>
          <input class="form-control" id="vUrl" placeholder="https://www.youtube.com/watch?v=...">
          <p class="form-hint">يدعم روابط youtube.com و youtu.be و shorts</p>
        </div>
        <div class="form-group">
          <label>الوصف</label>
          <textarea class="form-control" id="vDesc" placeholder="وصف مختصر للفيديو"></textarea>
        </div>
        <button class="btn btn-gold btn-block" onclick="saveVideo()"><i class="fas fa-save"></i> حفظ</button>
      `);
    }

    function saveVideo() {
      const s = document.getElementById('vStage').value;
      const t = document.getElementById('vTitle').value.trim();
      const u = document.getElementById('vUrl').value.trim();
      const d = document.getElementById('vDesc').value.trim();

      if (!validateField(t, 'العنوان', 3)) return;
      if (!validateField(u, 'الرابط', 10)) return;

      const vid = extractYouTubeId(u);
      if (!vid) { showToast('رابط يوتيوب غير صالح', 'error'); return; }

      DB.content[s].push({
        id: 'v_' + Date.now(),
        stageId: s,
        title: t,
        videoId: vid,
        url: u,
        description: d,
        type: 'video',
        date: new Date().toISOString()
      });
      saveDB();
      closeModal();
      renderContent();
      showToast('تمت إضافة الفيديو بنجاح!');
    }

    function uploadPDF() {
      showModal('رفع ملف PDF', `
        <div class="form-group">
          <label>الصف الدراسي</label>
          <select class="form-control" id="pStage">
            ${STAGES.map(s => `<option value="${s}">${getStageName(s)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>عنوان المذكرة</label>
          <input class="form-control" id="pTitle" placeholder="مثال: ملخص الفصل الأول">
        </div>
        <div class="form-group">
          <label>الوصف</label>
          <textarea class="form-control" id="pDesc" placeholder="وصف المذكرة"></textarea>
        </div>
        <div class="form-group">
          <label>ملف PDF</label>
          <div class="upload-area" id="pdfDropArea">
            <i class="fas fa-cloud-upload-alt"></i>
            <p>اسحب الملف هنا أو اضغط للاختيار</p>
            <p class="form-hint">الحد الأقصى: 5MB</p>
            <input type="file" id="pdfInp" accept=".pdf" style="display:none" onchange="handlePdf(this)">
          </div>
          <div id="pdfInfo"></div>
        </div>
        <button class="btn btn-gold btn-block" onclick="savePDF()"><i class="fas fa-upload"></i> رفع</button>
      `);
      window._pdf = null;
      setupDragDrop('pdfDropArea', 'pdfInp', '.pdf');
    }

    function handlePdf(inp) {
      const f = inp.files[0];
      if (f) {
        if (f.size > 5 * 1024 * 1024) {
          showToast('حجم الملف يتجاوز 5MB', 'error');
          inp.value = '';
          return;
        }
        window._pdf = f;
        document.getElementById('pdfInfo').innerHTML = `
          <div class="file-info">
            <i class="fas fa-file-pdf"></i>
            <div style="flex:1;">
              <strong>${Security.escapeHtml(f.name)}</strong>
              <span style="color:var(--text-secondary);margin-right:10px;">${formatSize(f.size)}</span>
            </div>
            <button class="btn btn-sm btn-danger" onclick="window._pdf=null;document.getElementById('pdfInfo').innerHTML='';" style="padding:3px 8px;">
              <i class="fas fa-times"></i>
            </button>
          </div>
        `;
      }
    }

    
    async function savePDF() {
      const s = document.getElementById('pStage').value;
      const t = document.getElementById('pTitle').value.trim();
      const d = document.getElementById('pDesc').value.trim();

      if (!validateField(t, 'العنوان', 3)) return;
      if (!window._pdf) { showToast('اختر ملف PDF', 'error'); return; }

      try {
        showToast('جاري رفع الملف على Cloudinary...', 'info');
        const fileId = 'pdf_' + Date.now();
        const result = await uploadToCloudinary(window._pdf, s);

        DB.content[s].push({
          id: fileId,
          stageId: s,
          title: t,
          description: d,
          type: 'pdf',
          fileName: window._pdf.name,
          fileSize: window._pdf.size,
          fileUrl: result.url,
          cloudinaryPublicId: result.publicId,
          date: new Date().toISOString()
        });
        saveDB();
        closeModal();
        renderContent();
        showToast('تم رفع الملف بنجاح!');
      } catch (e) {
        console.error('Cloudinary upload error:', e);
        showToast('خطأ في رفع الملف: ' + e.message, 'error');
      }
    }


    function uploadFile() {
      showModal('رفع ملف تعليمي', `
        <div class="form-group">
          <label>الصف الدراسي</label>
          <select class="form-control" id="fStage">
            ${STAGES.map(s => `<option value="${s}">${getStageName(s)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>عنوان الملف</label>
          <input class="form-control" id="fTitle" placeholder="مثال: تمارين الفصل الثاني">
        </div>
        <div class="form-group">
          <label>الوصف</label>
          <textarea class="form-control" id="fDesc" placeholder="وصف الملف"></textarea>
        </div>
        <div class="form-group">
          <label>اختر الملف</label>
          <div class="upload-area" id="fileDropArea">
            <i class="fas fa-cloud-upload-alt"></i>
            <p>اسحب الملف هنا أو اضغط للاختيار</p>
            <p class="form-hint">Word, PowerPoint, Excel, صور | الحد الأقصى: 10MB</p>
            <input type="file" id="fileInp" accept=".doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.gif" style="display:none" onchange="handleFile(this)">
          </div>
          <div id="fileInfo"></div>
        </div>
        <button class="btn btn-gold btn-block" onclick="saveFile()"><i class="fas fa-upload"></i> رفع</button>
      `);
      window._file = null;
      setupDragDrop('fileDropArea', 'fileInp', '.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.gif');
    }

    function handleFile(inp) {
      const f = inp.files[0];
      if (f) {
        if (f.size > 10 * 1024 * 1024) {
          showToast('حجم الملف يتجاوز 10MB', 'error');
          inp.value = '';
          return;
        }
        window._file = f;
        document.getElementById('fileInfo').innerHTML = `
          <div class="file-info">
            <i class="fas fa-file"></i>
            <div style="flex:1;">
              <strong>${Security.escapeHtml(f.name)}</strong>
              <span style="color:var(--text-secondary);margin-right:10px;">${formatSize(f.size)}</span>
            </div>
            <button class="btn btn-sm btn-danger" onclick="window._file=null;document.getElementById('fileInfo').innerHTML='';" style="padding:3px 8px;">
              <i class="fas fa-times"></i>
            </button>
          </div>
        `;
      }
    }

    
    async function saveFile() {
      const s = document.getElementById('fStage').value;
      const t = document.getElementById('fTitle').value.trim();
      const d = document.getElementById('fDesc').value.trim();

      if (!validateField(t, 'العنوان', 3)) return;
      if (!window._file) { showToast('اختر ملف', 'error'); return; }

      try {
        showToast('جاري رفع الملف على Cloudinary...', 'info');
        const fileId = 'file_' + Date.now();
        const result = await uploadToCloudinary(window._file, s);

        DB.content[s].push({
          id: fileId,
          stageId: s,
          title: t,
          description: d,
          type: 'file',
          fileName: window._file.name,
          fileSize: window._file.size,
          fileUrl: result.url,
          cloudinaryPublicId: result.publicId,
          date: new Date().toISOString()
        });
        saveDB();
        closeModal();
        renderContent();
        showToast('تم رفع الملف بنجاح!');
      } catch (e) {
        console.error('Cloudinary upload error:', e);
        showToast('خطأ في رفع الملف: ' + e.message, 'error');
      }
    }


    function setupDragDrop(dropAreaId, inputId, acceptTypes) {
      const area = document.getElementById(dropAreaId);
      const input = document.getElementById(inputId);
      if (!area || !input) return;

      ['dragenter', 'dragover'].forEach(evt => {
        area.addEventListener(evt, e => {
          e.preventDefault();
          area.style.borderColor = 'var(--gold-dark)';
          area.style.background = 'rgba(201,168,76,0.08)';
        });
      });

      ['dragleave', 'drop'].forEach(evt => {
        area.addEventListener(evt, e => {
          e.preventDefault();
          area.style.borderColor = 'var(--gold)';
          area.style.background = 'transparent';
        });
      });

      area.addEventListener('drop', e => {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
          const fakeEvent = { target: { files: files, value: '' } };
          if (inputId === 'pdfInp') handlePdf(fakeEvent.target);
          else handleFile(fakeEvent.target);
        }
      });

      area.addEventListener('click', () => input.click());
    }

    function playVideo(videoId, title) {
      if (!videoId) { showToast('رابط الفيديو غير متوفر', 'error'); return; }
      const eff = getEffectiveUser();
      if (eff && eff.id) {
        if (!DB.tracking[eff.id]) {
          DB.tracking[eff.id] = { completedLessons: [], videoProgress: {}, examScores: {} };
        }
        DB.tracking[eff.id].videoProgress[videoId] = {
          title: title,
          watched: true,
          watchedAt: new Date().toISOString()
        };
        saveDB();
      }
      const embedUrl = `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&controls=1&iv_load_policy=3&cc_load_policy=0&fs=0`;
      const studentName = currentUser ? currentUser.name : 'طالب';
      const watermarkId = 'wm_' + Date.now();

      showModal(title, `
        <div id="videoProtect_${watermarkId}" style="position:relative;border-radius:15px;overflow:hidden;background:#000;-webkit-user-select:none;user-select:none;" oncontextmenu="return false;" ondragstart="return false;">
          <div style="position:relative;padding-top:56.25%;">
            <iframe src="${embedUrl}"
              id="player_${watermarkId}"
              style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen>
            </iframe>
          </div>
          <div style="position:absolute;bottom:0;right:0;width:200px;height:40px;pointer-events:none;z-index:11;background:rgba(0,0,0,0.9);border-radius:10px 0 0 0;"></div>
          <div id="watermark_${watermarkId}" style="
            position:absolute;top:10px;left:10px;
            pointer-events:none;z-index:10;
            background:rgba(0,0,0,0.4);
            color:rgba(255,255,255,0.7);
            font-size:11px;
            padding:3px 8px;
            border-radius:4px;
            font-weight:bold;
            letter-spacing:0.5px;
            white-space:nowrap;
          ">${Security.escapeHtml(studentName)} | العبقري</div>
          <style>
            #videoProtect_${watermarkId} img { -webkit-user-drag:none; user-drag:none; pointer-events:none; }
          </style>
        </div>
        <div style="text-align:center;margin-top:12px;">
          <button class="btn btn-gold" onclick="document.getElementById('generalModal').classList.remove('show');">
            <i class="fas fa-times"></i> إغلاق
          </button>
        </div>
      `);
    }

    
    function downloadItem(stageId, id) {
      const item = (DB.content[stageId] || []).find(c => c.id === id);
      if (item) {
        const eff = getEffectiveUser();
        if (eff && eff.id && !DB.tracking[eff.id]?.completedLessons?.includes(id)) {
          if (!DB.tracking[eff.id]) {
            DB.tracking[eff.id] = { completedLessons: [], videoProgress: {}, examScores: {} };
          }
          DB.tracking[eff.id].completedLessons.push(id);
          saveDB();
        }
      }
      if (item?.fileUrl) {
          window.open(item.fileUrl, '_blank');
          return;
      }
      if (!item?.fileData) { showToast('الملف غير متوفر', 'error'); return; }
      const a = document.createElement('a');
      a.href = item.fileData;
      a.download = item.fileName || item.title;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('جاري التحميل...');
    }


    async function deleteItem(stageId, id) {
      const item = (DB.content[stageId] || []).find(c => c.id === id);
      if (!item) return;
      if (confirm(`هل أنت متأكد من حذف "${item.title}"؟`)) {
        showToast('جاري حذف الملف من السيرفر...', 'info');
        let deleted = false;
        if (item.cloudinaryPublicId) {
          console.log('Deleting with stored publicId:', item.cloudinaryPublicId);
          deleted = await deleteFromCloudinary(item.cloudinaryPublicId);
        }
        if (!deleted && item.fileUrl) {
          const extractedId = extractPublicIdFromUrl(item.fileUrl);
          console.log('Extracted publicId from URL:', extractedId);
          if (extractedId) await deleteFromCloudinary(extractedId);
        }
        DB.content[stageId] = (DB.content[stageId] || []).filter(c => c.id !== id);
        saveDB();
        renderContent();
        showToast('تم الحذف بنجاح');
      }
    }

    // ============ Exams Management (Teacher) ============
    function loadExamsManager() {
      document.getElementById('dashboardContent').innerHTML = `
        <h2 style="color: var(--gold); margin-bottom: 25px;">
          <i class="fas fa-file-alt"></i> إدارة الامتحانات
        </h2>
        <div class="tabs" id="examStageTabs">
          ${STAGES.map((s, i) => `<button class="tab-btn ${i === 0 ? 'active' : ''}" data-stage="${s}">${getStageName(s)}</button>`).join('')}
        </div>
        <button class="btn btn-gold" onclick="createExam()" style="margin-bottom:20px;">
          <i class="fas fa-plus"></i> إنشاء امتحان جديد
        </button>
        <div class="lesson-grid" id="examGrid"></div>
      `;

      document.querySelectorAll('#examStageTabs .tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          document.querySelectorAll('#examStageTabs .tab-btn').forEach(b => b.classList.remove('active'));
          this.classList.add('active');
          renderExams();
        });
      });

      renderExams();
    }

    function renderExams() {
      const activeStage = document.querySelector('#examStageTabs .tab-btn.active')?.dataset?.stage || 'prep1';
      const exams = DB.exams[activeStage] || [];
      const grid = document.getElementById('examGrid');
      if (!grid) return;

      if (exams.length === 0) {
        grid.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-file-alt"></i>
            <p>لا توجد امتحانات في ${getStageName(activeStage)}</p>
          </div>
        `;
        return;
      }

      grid.innerHTML = exams.map((exam, i) => `
        <div class="exam-card">
          <div style="text-align:center;font-size:3rem;margin-bottom:10px;">📝</div>
          <h4>${Security.escapeHtml(exam.title)}</h4>
          <p style="color:var(--text-secondary);">${Security.escapeHtml(exam.description || '')}</p>
          <p style="margin-top:8px;">
            <span class="badge badge-info">${exam.questions.length} سؤال</span>
            <span class="badge">${exam.duration} دقيقة</span>
          </p>
          <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-sm btn-info" onclick="editExamQs('${activeStage}',${i})">
              <i class="fas fa-edit"></i> تعديل
            </button>
            <button class="btn btn-sm btn-success" onclick="previewExam('${activeStage}',${i})">
              <i class="fas fa-eye"></i> معاينة
            </button>
            <button class="btn btn-sm btn-danger" onclick="deleteExam('${activeStage}',${i})">
              <i class="fas fa-trash"></i> حذف
            </button>
          </div>
        </div>
      `).join('');
    }

    function createExam() {
      showModal('إنشاء امتحان جديد', `
        <div class="form-group">
          <label>اسم الامتحان</label>
          <input class="form-control" id="examTitle" placeholder="مثال: امتحان منتصف الفصل">
        </div>
        <div class="form-group">
          <label>الوصف</label>
          <textarea class="form-control" id="examDesc" placeholder="وصف الامتحان"></textarea>
        </div>
        <div class="form-group">
          <label>المدة (دقائق)</label>
          <input type="number" class="form-control" id="examDur" value="60" min="5" max="300">
        </div>
        <button class="btn btn-gold btn-block" onclick="saveExam()"><i class="fas fa-arrow-left"></i> متابعة لإضافة الأسئلة</button>
      `);
    }

    function saveExam() {
      const t = document.getElementById('examTitle').value.trim();
      const d = document.getElementById('examDesc').value.trim();
      const dur = parseInt(document.getElementById('examDur').value) || 60;

      if (!validateField(t, 'اسم الامتحان', 3)) return;

      const activeStage = document.querySelector('#examStageTabs .tab-btn.active')?.dataset?.stage || 'prep1';
      const exam = {
        id: 'exam_' + Date.now(),
        title: t,
        description: d,
        duration: dur,
        questions: [],
        createdAt: new Date().toISOString()
      };
      DB.exams[activeStage].push(exam);
      saveDB();
      closeModal();
      editExamQs(activeStage, DB.exams[activeStage].length - 1);
    }

    function editExamQs(stageId, examIndex) {
      const exam = DB.exams[stageId][examIndex];
      if (!exam) return;

      showModal(`تعديل أسئلة: ${exam.title}`, `
        <div id="qsList">
          ${exam.questions.length === 0 ? '<p style="color:var(--text-secondary);text-align:center;padding:20px;">لا توجد أسئلة بعد. أضف السؤال الأولأدناه.</p>' : ''}
          ${exam.questions.map((q, qi) => `
            <div class="question-item">
              <div style="display:flex;justify-content:space-between;align-items:start;">
                <h4 style="color:var(--gold);">سؤال ${qi + 1}</h4>
                <button class="btn btn-sm btn-danger" onclick="removeQ('${stageId}',${examIndex},${qi})">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
              <p style="margin:8px 0;"><strong>${Security.escapeHtml(q.text)}</strong></p>
              ${q.options.map((o, oi) => `
                <div class="option-item ${oi === q.correctAnswer ? 'correct' : ''}">
                  ${oi + 1}. ${Security.escapeHtml(o)}
                  ${oi === q.correctAnswer ? ' <i class="fas fa-check-circle" style="color:var(--success);margin-right:auto;"></i>' : ''}
                </div>
              `).join('')}
            </div>
          `).join('')}
        </div>
        <div style="border-top:2px solid var(--gold);padding-top:20px;margin-top:20px;">
          <h4 style="color:var(--gold);margin-bottom:15px;"><i class="fas fa-plus-circle"></i> إضافة سؤال جديد</h4>
          <div class="form-group">
            <label>نص السؤال</label>
            <textarea class="form-control" id="qText" placeholder="اكتب السؤال هنا..."></textarea>
          </div>
          <div class="form-group">
            <label>الخيارات (4 خيارات)</label>
            <input class="form-control qOpt" placeholder="الخيار الصحيح" style="margin-bottom:5px;">
            <input class="form-control qOpt" placeholder="الخيار الثاني" style="margin-bottom:5px;">
            <input class="form-control qOpt" placeholder="الخيار الثالث" style="margin-bottom:5px;">
            <input class="form-control qOpt" placeholder="الخيار الرابع">
          </div>
          <div class="form-group">
            <label>رقم الإجابة الصحيحة (1-4)</label>
            <input type="number" class="form-control" id="qCorrect" min="1" max="4" value="1">
          </div>
          <button class="btn btn-gold btn-block" onclick="addQ('${stageId}',${examIndex})">
            <i class="fas fa-plus"></i> إضافة السؤال
          </button>
        </div>
        <button class="btn btn-success btn-block" style="margin-top:15px;" onclick="closeModal();renderExams();">
          <i class="fas fa-check"></i> إنهاء التعديل
        </button>
      `);
    }

    function addQ(stageId, examIndex) {
      const text = document.getElementById('qText').value.trim();
      const opts = Array.from(document.querySelectorAll('.qOpt')).map(i => i.value.trim()).filter(v => v);
      const correct = parseInt(document.getElementById('qCorrect').value) - 1;

      if (!validateField(text, 'نص السؤال', 5)) return;
      if (opts.length < 2) { showToast('أدخل خيارين على الأقل', 'error'); return; }
      if (correct < 0 || correct >= opts.length) { showToast('رقم الإجابة غير صحيح', 'error'); return; }

      DB.exams[stageId][examIndex].questions.push({
        id: 'q_' + Date.now(),
        text: text,
        options: opts,
        correctAnswer: correct
      });
      saveDB();
      editExamQs(stageId, examIndex);
      showToast('تمت إضافة السؤال!');
    }

    function removeQ(stageId, examIndex, qIndex) {
      if (confirm('حذف هذا السؤال؟')) {
        DB.exams[stageId][examIndex].questions.splice(qIndex, 1);
        saveDB();
        editExamQs(stageId, examIndex);
        showToast('تم الحذف');
      }
    }

    function previewExam(stageId, examIndex) {
      const exam = DB.exams[stageId][examIndex];
      if (!exam) return;

      let html = `
        <h3 style="color:var(--gold);margin-bottom:10px;">${Security.escapeHtml(exam.title)}</h3>
        <p style="color:var(--text-secondary);">${Security.escapeHtml(exam.description || '')}</p>
        <p><span class="badge">${exam.duration} دقيقة</span> <span class="badge badge-info">${exam.questions.length} سؤال</span></p>
        <hr style="border-color:var(--gold);margin:15px 0;">
      `;

      exam.questions.forEach((q, i) => {
        html += `
          <div class="question-item">
            <h4 style="color:var(--gold);">سؤال ${i + 1}</h4>
            <p style="margin:8px 0;"><strong>${Security.escapeHtml(q.text)}</strong></p>
            ${q.options.map((o, oi) => `
              <div class="option-item ${oi === q.correctAnswer ? 'correct' : ''}">
                ${Security.escapeHtml(o)}
                ${oi === q.correctAnswer ? ' <i class="fas fa-check-circle" style="color:var(--success);margin-right:auto;"></i>' : ''}
              </div>
            `).join('')}
          </div>
        `;
      });

      showModal(`معاينة: ${exam.title}`, html);
    }

    function deleteExam(stageId, examIndex) {
      if (confirm('هل أنت متأكد من حذف هذا الامتحان؟')) {
        DB.exams[stageId].splice(examIndex, 1);
        saveDB();
        renderExams();
        showToast('تم الحذف');
      }
    }

    // ============ Students Management ============
    function loadStudentsManager() {
      document.getElementById('dashboardContent').innerHTML = `
        <h2 style="color: var(--gold); margin-bottom: 25px;">
          <i class="fas fa-users"></i> إدارة الطلاب
        </h2>
        <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;">
          <button class="btn btn-gold" onclick="addStudent()"><i class="fas fa-user-plus"></i> إضافة طالب</button>
        </div>
        <div class="search-bar">
          <input type="text" class="form-control" placeholder="بحث بالاسم أو الصف..." id="studentSearch" oninput="renderStudentsTable()">
          <select class="form-control" style="max-width:200px;" id="studentFilter" onchange="renderStudentsTable()">
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
      `;
      renderStudentsTable();
    }

    function renderStudentsTable() {
      const search = (document.getElementById('studentSearch')?.value || '').toLowerCase();
      const filter = document.getElementById('studentFilter')?.value || 'all';
      const tbody = document.getElementById('studentsTableBody');
      if (!tbody) return;

      let students = DB.students;
      if (filter !== 'all') students = students.filter(s => s.grade === filter);
      if (search) students = students.filter(s => s.name.toLowerCase().includes(search) || getStageName(s.grade).includes(search));

      if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-secondary);">لا يوجد طلاب</td></tr>';
        return;
      }

      tbody.innerHTML = students.map((s, i) => {
        const p = DB.parents.find(pr => pr.studentId === s.id);
        return `
          <tr>
            <td>${i + 1}</td>
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
              <button class="btn btn-sm btn-danger" onclick="delStudent('${s.id}')" title="حذف">
                <i class="fas fa-trash"></i>
              </button>
            </td>
          </tr>
        `;
      }).join('');
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

    function genAccounts() {
      const sn = document.getElementById('sName').value.trim();
      const sg = document.getElementById('sGrade').value;
      const pn = document.getElementById('pName').value.trim();

      if (!validateField(sn, 'اسم الطالب', 2)) return;
      if (!validateField(pn, 'اسم ولي الأمر', 2)) return;

      let su, pu;
      do { su = generateUsername(sn, 'student'); } while (DB.students.some(s => s.username === su));
      do { pu = generateUsername(pn, 'parent'); } while (DB.parents.some(p => p.username === pu));

      const sp = generatePassword(), pp = generatePassword();
      const sid = 's_' + Date.now(), pid = 'p_' + Date.now();

      DB.students.push({
        id: sid, username: su, password: Security.hashPassword(sp),
        name: sn, grade: sg, role: 'student',
        createdAt: new Date().toISOString()
      });
      DB.parents.push({
        id: pid, username: pu, password: Security.hashPassword(pp),
        name: pn, studentId: sid, role: 'parent',
        createdAt: new Date().toISOString()
      });
      DB.tracking[sid] = {
        studentId: sid, studentName: sn, grade: sg,
        completedLessons: [], videoProgress: {}, examScores: {}
      };
      saveDB();

      document.getElementById('genResult').innerHTML = `
          <div style="background:var(--input-bg);padding:20px;border-radius:15px;border:2px solid var(--success);">
          <h4 style="color:var(--success);margin-bottom:15px;"><i class="fas fa-check-circle"></i> تم الإنشاء بنجاح!</h4>
          <div style="background:var(--dark-bg);padding:12px;border-radius:8px;margin-bottom:10px;font-family:monospace;line-height:2;border:1px solid var(--border-color);">
            <strong style="color:var(--gold);">🎓 الطالب:</strong><br>
            <span>المستخدم: ${Security.escapeHtml(su)}</span><br>
            <span>كلمة المرور: ${Security.escapeHtml(sp)}</span>
          </div>
          <div style="background:var(--dark-bg);padding:12px;border-radius:8px;font-family:monospace;line-height:2;border:1px solid var(--border-color);">
            <strong style="color:var(--gold);">👨‍👧 ولي الأمر:</strong><br>
            <span>المستخدم: ${Security.escapeHtml(pu)}</span><br>
            <span>كلمة المرور: ${Security.escapeHtml(pp)}</span>
          </div>
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
      showModal('بيانات دخول الطالب', `
        <div style="text-align:center;margin-bottom:20px;">
          <div class="avatar" style="width:60px;height:60px;font-size:1.5rem;margin:0 auto 10px;">${s.name.charAt(0)}</div>
          <h3 style="color:var(--gold);">${Security.escapeHtml(s.name)}</h3>
          <p style="color:var(--text-secondary);">${getStageName(s.grade)}</p>
        </div>
        <div style="background:var(--input-bg);padding:15px;border-radius:10px;font-family:monospace;line-height:2;border:1px solid var(--border-color);">
          <p><strong style="color:var(--gold);">المستخدم:</strong> ${Security.escapeHtml(s.username)}</p>
          <p><strong style="color:var(--gold);">كلمة المرور:</strong> ${Security.escapeHtml(s.password)}</p>
        </div>
        <button class="btn btn-info btn-block" style="margin-top:15px;" onclick="copyCredentials('${Security.escapeHtml(s.username)}','${Security.escapeHtml(s.password)}')">
          <i class="fas fa-copy"></i> نسخ البيانات
        </button>
      `);
    }

    function copyCredentials(user, pass) {
      navigator.clipboard.writeText(`المستخدم: ${user}\nكلمة المرور: ${pass}`).then(() => {
        showToast('تم النسخ!');
      }).catch(() => {
        showToast('لم يتم النسخ', 'error');
      });
    }

    function viewStudentTracking(sid) {
      const s = DB.students.find(st => st.id === sid);
      if (!s) return;
      currentUser._tempViewStudent = s;
      navigate('tracking');
    }

    function delStudent(sid) {
      const s = DB.students.find(st => st.id === sid);
      if (!s) return;
      if (confirm(`هل أنت متأكد من حذف الطالب "${s.name}" وولي أمره؟`)) {
        const p = DB.parents.find(pr => pr.studentId === sid);
        DB.students = DB.students.filter(s => s.id !== sid);
        if (p) DB.parents = DB.parents.filter(pr => pr.id !== p.id);
        delete DB.tracking[sid];
        saveDB();
        renderStudentsTable();
        showToast('تم الحذف');
      }
    }

    // ============ Tracking (Teacher) ============
    function loadTracking() {
      let html = `
        <h2 style="color: var(--gold); margin-bottom: 25px;">
          <i class="fas fa-chart-line"></i> متابعة الطلاب
        </h2>
      `;

      const targetStudent = currentUser._tempViewStudent;
      const studentsToShow = targetStudent ? [targetStudent] : DB.students;

      if (studentsToShow.length === 0) {
        html += `
          <div class="empty-state">
            <i class="fas fa-user-graduate"></i>
            <p>لا يوجد طلاب مسجلين بعد</p>
          </div>
        `;
        document.getElementById('dashboardContent').innerHTML = html;
        return;
      }

      if (targetStudent) {
        html += `
          <button class="btn btn-outline" onclick="currentUser._tempViewStudent=null;loadTracking();" style="margin-bottom:15px;">
            <i class="fas fa-arrow-right"></i> العودة لقائمة الطلاب
          </button>
        `;
      }

      studentsToShow.forEach(student => {
        const tracking = DB.tracking[student.id] || { completedLessons: [], videoProgress: {}, examScores: {} };
        const totalLessons = (DB.content[student.grade] || []).length;
        const completedCount = tracking.completedLessons.length;
        const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
        const examCount = Object.keys(tracking.examScores).length;
        const avgScore = examCount > 0 ?
          Math.round(Object.values(tracking.examScores).reduce((a, b) => a + b, 0) / examCount) : 0;

        html += `
          <div class="tracking-card" style="margin-bottom:25px;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
              <div>
                <h3 style="color:var(--gold);">${Security.escapeHtml(student.name)}</h3>
                <p style="color:var(--text-secondary);">${getStageName(student.grade)}</p>
              </div>
              <span class="badge ${progressPercent >= 70 ? 'badge-success' : progressPercent >= 40 ? 'badge-warning' : 'badge-danger'}">
                ${progressPercent}% تقدم
              </span>
            </div>

            <div class="stats-grid" style="margin:20px 0;">
              <div class="stat-card">
                <div class="stat-value">${completedCount}/${totalLessons}</div>
                <div class="stat-label">الدروس المكتملة</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${examCount}</div>
                <div class="stat-label">امتحانات محلولة</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${avgScore}%</div>
                <div class="stat-label">متوسط الدرجات</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${Object.keys(tracking.videoProgress).length}</div>
                <div class="stat-label">فيديوهات مشاهدة</div>
              </div>
            </div>

            <div class="progress-bar" style="margin-bottom:20px;">
              <div class="progress-fill" style="width:${progressPercent}%;"></div>
            </div>

            ${examCount > 0 ? `
              <h4 style="color:var(--gold);margin-bottom:10px;"><i class="fas fa-file-alt"></i> نتائج الامتحانات</h4>
              <div class="table-container">
                <table>
                  <thead><tr><th>الامتحان</th><th>النتيجة</th><th>الحالة</th></tr></thead>
                  <tbody>
                    ${Object.entries(tracking.examScores).map(([examId, score]) => `
                      <tr>
                        <td>${Security.escapeHtml(examId)}</td>
                        <td><strong>${score}%</strong></td>
                        <td>
                          <span class="badge ${score >= 70 ? 'badge-success' : score >= 50 ? 'badge-warning' : 'badge-danger'}">
                            ${score >= 70 ? 'ناجح' : score >= 50 ? 'متوسط' : 'راسب'}
                          </span>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : '<p style="color:var(--text-secondary);margin-top:10px;">لم يتم حل أي امتحان بعد</p>'}
          </div>
        `;
      });

      document.getElementById('dashboardContent').innerHTML = html;
    }

    // ============ Student/Parent: Content View ============
    function loadStudentContentView() {
      const eff = getEffectiveUser();
      const grade = eff.grade;
      const items = DB.content[grade] || [];

      document.getElementById('dashboardContent').innerHTML = `
        <h2 style="color: var(--gold); margin-bottom: 25px;">
          <i class="fas fa-book-open"></i> المحتوى التعليمي - ${getStageName(grade)}${currentUser.role === 'parent' ? ` (${Security.escapeHtml(eff.name)})` : ''}
        </h2>
        <div class="search-bar">
          <input type="text" class="form-control" placeholder="بحث في المحتوى..." id="studentContentSearch" oninput="renderStudentContent()">
        </div>
        <div class="lesson-grid" id="studentContentGrid"></div>
      `;
      renderStudentContent();
    }

    function renderStudentContent() {
      const eff = getEffectiveUser();
      const grade = eff.grade;
      const search = (document.getElementById('studentContentSearch')?.value || '').toLowerCase();
      let items = DB.content[grade] || [];

      if (search) {
        items = items.filter(i =>
          i.title.toLowerCase().includes(search) ||
          (i.description || '').toLowerCase().includes(search)
        );
      }

      const grid = document.getElementById('studentContentGrid');
      if (!grid) return;

      if (items.length === 0) {
        grid.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-inbox"></i>
            <p>لا يوجد محتوى متاح${search ? ' يطابق البحث' : ''}</p>
          </div>
        `;
        return;
      }

      const tracking = DB.tracking[eff.id] || { completedLessons: [], videoProgress: {} };

      grid.innerHTML = items.map(item => {
        let icon = '', badgeClass = '', badgeText = '';
        if (item.type === 'video') {
          icon = '<i class="fab fa-youtube" style="color:#f00;font-size:2.5rem;"></i>';
          badgeClass = 'badge-danger';
          badgeText = 'فيديو';
        } else if (item.type === 'pdf') {
          icon = '<i class="fas fa-file-pdf" style="color:#f44;font-size:2.5rem;"></i>';
          badgeClass = 'badge-danger';
          badgeText = 'PDF';
        } else {
          icon = '<i class="fas fa-file" style="color:#2196f3;font-size:2.5rem;"></i>';
          badgeClass = 'badge-info';
          badgeText = 'ملف';
        }

        const isWatched = item.type === 'video' && item.videoId && tracking.videoProgress[item.videoId]?.watched;
        const isCompleted = item.type !== 'video' && tracking.completedLessons.includes(item.id);
        const statusBadge = isWatched ? '<span class="badge badge-success" style="margin-right:5px;"><i class="fas fa-check"></i> تم المشاهدة</span>' :
                            isCompleted ? '<span class="badge badge-success" style="margin-right:5px;"><i class="fas fa-check"></i> تم التحميل</span>' : '';

        return `
          <div class="content-card">
            <span class="badge ${badgeClass}">${badgeText}</span> ${statusBadge}
            <div style="text-align:center;margin:15px 0;">${icon}</div>
            <h4>${Security.escapeHtml(item.title)}</h4>
            <p style="color:var(--text-secondary);font-size:0.9rem;">${Security.escapeHtml(item.description || '')}</p>
            <p style="font-size:0.8rem;color:var(--text-secondary);margin-top:8px;">
              <i class="fas fa-calendar"></i> ${formatDate(item.date)}
            </p>
            <div style="margin-top:12px;">
              ${item.type === 'video' ?
                `<button class="btn btn-info btn-block" onclick="playVideo('${item.videoId}','${Security.escapeHtml(item.title).replace(/'/g, "\\'")}')"><i class="fas fa-play"></i> مشاهدة</button>` :
                `<button class="btn btn-info btn-block" onclick="downloadItem('${item.stageId || grade}','${item.id}')"><i class="fas fa-download"></i> تحميل</button>`
              }
            </div>
          </div>
        `;
      }).join('');
    }

    // ============ Student: Exams View ============
    function loadStudentExamsView() {
      const eff = getEffectiveUser();
      const grade = eff.grade;
      const exams = DB.exams[grade] || [];

      document.getElementById('dashboardContent').innerHTML = `
        <h2 style="color: var(--gold); margin-bottom: 25px;">
          <i class="fas fa-file-alt"></i> الامتحانات المتاحة - ${getStageName(grade)}${currentUser.role === 'parent' ? ` (${Security.escapeHtml(eff.name)})` : ''}
        </h2>
        <div class="lesson-grid" id="studentExamGrid"></div>
      `;

      const grid = document.getElementById('studentExamGrid');
      if (exams.length === 0) {
        grid.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-file-alt"></i>
            <p>لا توجد امتحانات متاحة حالياً</p>
          </div>
        `;
        return;
      }

      const tracking = DB.tracking[eff.id] || { examScores: {} };

      grid.innerHTML = exams.map((exam, i) => {
        const score = tracking.examScores[exam.id];
        const hasTaken = score !== undefined;

        return `
          <div class="exam-card">
            <div style="text-align:center;font-size:3rem;margin-bottom:10px;">📝</div>
            <h4>${Security.escapeHtml(exam.title)}</h4>
            <p style="color:var(--text-secondary);">${Security.escapeHtml(exam.description || '')}</p>
            <p style="margin:8px 0;">
              <span class="badge badge-info">${exam.questions.length} سؤال</span>
              <span class="badge">${exam.duration} دقيقة</span>
            </p>
            ${hasTaken ? `
              <div style="margin-top:10px;">
                <span class="badge ${score >= 70 ? 'badge-success' : score >= 50 ? 'badge-warning' : 'badge-danger'}">
                  نتيجتك: ${score}%
                </span>
              </div>
            ` : ''}
            <div style="margin-top:12px;">
              ${!hasTaken ?
                `<button class="btn btn-gold btn-block" onclick="startExam('${grade}',${i})"><i class="fas fa-play"></i> بدء الامتحان</button>` :
                `<div style="text-align:center;color:var(--success);font-weight:bold;"><i class="fas fa-check-circle"></i> تم التسليم</div>`
              }
            </div>
          </div>
        `;
      }).join('');
    }

    function loadStudentMyExams() {
      loadStudentExamsView();
    }

    // ============ Exam Taking ============
    function startExam(stageId, examIndex) {
      const exam = DB.exams[stageId][examIndex];
      if (!exam || exam.questions.length === 0) {
        showToast('هذا الامتحان لا يحتوي على أسئلة', 'error');
        return;
      }

      if (!confirm(`هل أنت مستعد لبدء امتحان "${exam.title}"?\nالمدة: ${exam.duration} دقيقة\nعدد الأسئلة: ${exam.questions.length}`)) return;

      examState = {
        currentExam: { stageId, examIndex, exam },
        answers: {},
        timeRemaining: exam.duration * 60,
        timerInterval: null,
        currentQuestion: 0
      };

      document.getElementById('examModal').classList.add('show');
      renderExamQuestion();

      examState.timerInterval = setInterval(() => {
        examState.timeRemaining--;
        updateTimerDisplay();
        if (examState.timeRemaining <= 0) {
          submitExam();
        }
      }, 1000);
    }


    function updateTimerDisplay() {
      const timerEl = document.getElementById('examTimer');
      if (!timerEl) return;
      timerEl.textContent = formatTime(examState.timeRemaining);
      timerEl.className = 'timer-display' + (examState.timeRemaining <= 60 ? ' warning' : '');
    }

    function renderExamQuestion() {
      const exam = examState.currentExam.exam;
      const qi = examState.currentQuestion;
      const q = exam.questions[qi];
      const total = exam.questions.length;

      document.getElementById('examContent').innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:20px;">
          <h3 style="color:var(--gold);">${Security.escapeHtml(exam.title)}</h3>
          <div id="examTimer" class="timer-display">${formatTime(examState.timeRemaining)}</div>
        </div>

        <div class="progress-bar" style="margin-bottom:15px;">
          <div class="progress-fill" style="width:${((qi + 1) / total) * 100}%;"></div>
        </div>
        <p style="color:var(--text-secondary);margin-bottom:15px;">السؤال ${qi + 1} من ${total}</p>

        <div class="exam-question">
          <h4>سؤال ${qi + 1}</h4>
          <div class="question-text">${Security.escapeHtml(q.text)}</div>
          <div id="examOptions">
            ${q.options.map((o, oi) => `
              <div class="option-item ${examState.answers[qi] === oi ? 'selected' : ''}" onclick="selectExamOption(${qi}, ${oi})">
                <span style="font-weight:bold;min-width:25px;">${oi + 1}.</span>
                <span>${Security.escapeHtml(o)}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="question-nav" style="margin:20px 0;">
          ${exam.questions.map((_, i) => `
            <button class="question-nav-btn ${i === qi ? 'current' : ''} ${examState.answers[i] !== undefined ? 'answered' : ''}"
              onclick="goToQuestion(${i})">${i + 1}</button>
          `).join('')}
        </div>

        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn btn-outline" ${qi === 0 ? 'disabled' : ''} onclick="prevQuestion()">
            <i class="fas fa-arrow-right"></i> السابق
          </button>
          <div style="flex:1;"></div>
          ${qi === total - 1 ?
            `<button class="btn btn-success" onclick="submitExam()"><i class="fas fa-paper-plane"></i> تسليم الامتحان</button>` :
            `<button class="btn btn-gold" onclick="nextQuestion()">التالي <i class="fas fa-arrow-left"></i></button>`
          }
        </div>
      `;
    }

    function selectExamOption(qi, oi) {
      examState.answers[qi] = oi;
      renderExamQuestion();
    }

    function goToQuestion(qi) {
      examState.currentQuestion = qi;
      renderExamQuestion();
    }

    function nextQuestion() {
      const exam = examState.currentExam.exam;
      if (examState.currentQuestion < exam.questions.length - 1) {
        examState.currentQuestion++;
        renderExamQuestion();
      }
    }

    function prevQuestion() {
      if (examState.currentQuestion > 0) {
        examState.currentQuestion--;
        renderExamQuestion();
      }
    }

    function submitExam() {
      if (examState.timerInterval) clearInterval(examState.timerInterval);

      const exam = examState.currentExam.exam;
      const total = exam.questions.length;
      let correct = 0;

      exam.questions.forEach((q, i) => {
        if (examState.answers[i] === q.correctAnswer) correct++;
      });

      const score = Math.round((correct / total) * 100);

      // Save score
      const effId = getEffectiveUser().id;
      if (!DB.tracking[effId]) {
        DB.tracking[effId] = { completedLessons: [], videoProgress: {}, examScores: {} };
      }
      DB.tracking[effId].examScores[exam.id] = score;
      saveDB();

      // Show result
      document.getElementById('examContent').innerHTML = `
        <div class="exam-result">
          <i class="fas fa-clipboard-check" style="font-size:4rem;color:var(--gold);"></i>
          <h2 style="color:var(--gold);margin:15px 0;">${Security.escapeHtml(exam.title)}</h2>
          <div class="score ${score >= 50 ? 'pass' : 'fail'}">${score}%</div>
          <p style="font-size:1.2rem;margin-bottom:10px;">
            ${correct} من ${total} إجابة صحيحة
          </p>
          <span class="badge ${score >= 70 ? 'badge-success' : score >= 50 ? 'badge-warning' : 'badge-danger'}" style="font-size:1.1rem;padding:8px 20px;">
            ${score >= 70 ? 'ممتاز - ناجح' : score >= 50 ? 'مقبول' : 'راسب - حاول مرة أخرى'}
          </span>

          <div style="margin-top:25px;">
            <h4 style="color:var(--gold);margin-bottom:15px;">المراجعة:</h4>
            ${exam.questions.map((q, i) => {
              const userAnswer = examState.answers[i];
              const isCorrect = userAnswer === q.correctAnswer;
              return `
                <div class="question-item" style="border-color:${isCorrect ? 'var(--success)' : 'var(--danger)'};">
                  <div style="display:flex;justify-content:space-between;align-items:center;">
                    <h4 style="color:var(--gold);">سؤال ${i + 1}</h4>
                    <span class="badge ${isCorrect ? 'badge-success' : 'badge-danger'}">
                      ${isCorrect ? 'صحيح' : 'خطأ'}
                    </span>
                  </div>
                  <p style="margin:8px 0;"><strong>${Security.escapeHtml(q.text)}</strong></p>
                  ${q.options.map((o, oi) => {
                    let cls = '';
                    if (oi === q.correctAnswer) cls = 'correct';
                    else if (oi === userAnswer && !isCorrect) cls = 'wrong';
                    return `
                      <div class="option-item ${cls}">
                        ${oi + 1}. ${Security.escapeHtml(o)}
                        ${oi === q.correctAnswer ? ' <i class="fas fa-check" style="color:var(--success);margin-right:auto;"></i>' : ''}
                        ${oi === userAnswer && !isCorrect ? ' <i class="fas fa-times" style="color:var(--danger);margin-right:auto;"></i>' : ''}
                      </div>
                    `;
                  }).join('')}
                </div>
              `;
            }).join('')}
          </div>

          <button class="btn btn-gold btn-block" style="margin-top:20px;" onclick="closeExamModal()">
            <i class="fas fa-times"></i> إغلاق
          </button>
        </div>
      `;
    }

    function closeExamModal() {
      document.getElementById('examModal').classList.remove('show');
      if (currentUser.role !== 'teacher') {
        loadStudentExamsView();
      }
    }

    // ============ Student Progress ============
    function loadStudentProgress() {
      const eff = getEffectiveUser();
      const tracking = DB.tracking[eff.id] || { completedLessons: [], videoProgress: {}, examScores: {} };
      const grade = eff.grade;
      const allContent = DB.content[grade] || [];
      const totalLessons = allContent.length;
      const completedCount = tracking.completedLessons.length;
      const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
      const examScores = Object.values(tracking.examScores);
      const avgScore = examScores.length > 0 ? Math.round(examScores.reduce((a, b) => a + b, 0) / examScores.length) : 0;

      document.getElementById('dashboardContent').innerHTML = `
        <h2 style="color: var(--gold); margin-bottom: 25px;">
          <i class="fas fa-chart-bar"></i> ${currentUser.role === 'parent' ? 'تقدم ' + Security.escapeHtml(eff.name) : 'تقدمي'} - ${getStageName(grade)}
        </h2>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${completedCount}/${totalLessons}</div>
            <div class="stat-label"><i class="fas fa-book-open"></i> الدروس</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${progressPercent}%</div>
            <div class="stat-label"><i class="fas fa-chart-line"></i> التقدم</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${examScores.length}</div>
            <div class="stat-label"><i class="fas fa-file-alt"></i> امتحانات محلولة</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${avgScore}%</div>
            <div class="stat-label"><i class="fas fa-star"></i> متوسط الدرجات</div>
          </div>
        </div>

        <div class="progress-bar" style="height:15px;margin-bottom:30px;">
          <div class="progress-fill" style="width:${progressPercent}%;"></div>
        </div>

        ${(() => {
          const watchedCount = Object.values(tracking.videoProgress || {}).filter(v => v.watched).length;
          const totalVideos = allContent.filter(c => c.type === 'video').length;
          return totalVideos > 0 ? `
            <div class="stats-grid" style="margin-bottom:25px;">
              <div class="stat-card">
                <div class="stat-value">${watchedCount}/${totalVideos}</div>
                <div class="stat-label"><i class="fas fa-video"></i> فيديوهات مشاهدة</div>
              </div>
            </div>
          ` : '';
        })()}

        ${examScores.length > 0 ? `
          <h3 style="color:var(--gold);margin-bottom:15px;"><i class="fas fa-file-alt"></i> نتائج الامتحانات</h3>
          <div class="table-container">
            <table>
              <thead><tr><th>الامتحان</th><th>النتيجة</th><th>التقييم</th></tr></thead>
              <tbody>
                ${Object.entries(tracking.examScores).map(([examId, score]) => {
                  let examTitle = examId;
                  const gradeExams = DB.exams[grade] || [];
                  const foundExam = gradeExams.find(e => e.id === examId);
                  if (foundExam) examTitle = foundExam.title;
                  return `
                  <tr>
                    <td>${Security.escapeHtml(examTitle)}</td>
                    <td><strong>${score}%</strong></td>
                    <td>
                      <span class="badge ${score >= 70 ? 'badge-success' : score >= 50 ? 'badge-warning' : 'badge-danger'}">
                        ${score >= 70 ? 'ممتاز' : score >= 50 ? 'جيد' : 'يحتاج تحسين'}
                      </span>
                    </td>
                  </tr>
                `;}).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="empty-state" style="padding:30px;">
            <i class="fas fa-clipboard-list"></i>
            <p>${currentUser.role === 'parent' ? 'لم يحل ابنك أي امتحان بعد.' : 'لم تحل أي امتحان بعد. جرب حل الامتحانات لتحسين مستواك!'}</p>
          </div>
        `}
      `;
    }

    // ============ Backup & Restore ============
    function showBackupModal() {
      showModal('النسخ الاحتياطي والاستعادة', `
        <div style="margin-bottom:25px;">
          <h4 style="color:var(--gold);margin-bottom:15px;"><i class="fas fa-download"></i> تصدير البيانات</h4>
          <p style="color:var(--text-secondary);margin-bottom:15px;">احفظ نسخة احتياطية من جميع البيانات على جهازك</p>
          <button class="btn btn-gold btn-block" onclick="exportData()"><i class="fas fa-download"></i> تصدير جميع البيانات</button>
        </div>
        <hr style="border-color:var(--border-color);margin:20px 0;">
        <div>
          <h4 style="color:var(--gold);margin-bottom:15px;"><i class="fas fa-upload"></i> استيراد البيانات</h4>
          <p style="color:var(--text-secondary);margin-bottom:15px;">استعادة البيانات من ملف نسخ احتياطي</p>
          <div class="upload-area" onclick="document.getElementById('backupInp').click()">
            <i class="fas fa-file-import"></i>
            <p>اختر ملف النسخ الاحتياطي</p>
            <input type="file" id="backupInp" accept=".json" style="display:none" onchange="importData(this)">
          </div>
        </div>
        <hr style="border-color:var(--border-color);margin:20px 0;">
        <div>
          <h4 style="color:var(--danger);margin-bottom:15px;"><i class="fas fa-trash"></i> مسح جميع البيانات</h4>
          <button class="btn btn-danger btn-block" onclick="clearAllData()"><i class="fas fa-trash"></i> مسح كل البيانات</button>
        </div>
      `);
    }

    function exportData() {
      const data = {
        teachers: DB.teachers,
        students: DB.students,
        parents: DB.parents,
        content: DB.content,
        exams: DB.exams,
        tracking: DB.tracking,
        exportDate: new Date().toISOString(),
        version: '2.0'
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `math-platform-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('تم التصدير بنجاح!');
    }

    function importData(inp) {
      const file = inp.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const data = JSON.parse(e.target.result);
          if (!data.version) throw new Error('ملف غير صالح');

          if (!confirm('سيتم استبدال جميع البيانات الحالية. هل أنت متأكد؟')) return;

          DB.teachers = data.teachers || DB.teachers;
          DB.students = data.students || [];
          DB.parents = data.parents || [];
          DB.content = data.content || DB.content;
          DB.exams = data.exams || DB.exams;
          DB.tracking = data.tracking || {};

          saveDB();

          closeModal();
          showToast('تم الاستيراد بنجاح! أعد تحميل الصفحة.');
          setTimeout(() => location.reload(), 2000);
        } catch (err) {
          showToast('خطأ في ملف البيانات: ' + err.message, 'error');
        }
      };
      reader.readAsText(file);
    }

    function clearAllData() {
      if (!confirm('هل أنت متأكد من مسح جميع البيانات؟')) return;
      if (!confirm('تأكيد أخير: سيتم حذف جميع البيانات نهائياً!')) return;

      DB.teachers = [];
      DB.students = [];
      DB.parents = [];
      DB.content = {"prep1":[],"prep2":[],"prep3":[],"sec1":[],"sec2":[],"sec3":[]};
      DB.exams = {"prep1":[],"prep2":[],"prep3":[],"sec1":[],"sec2":[],"sec3":[]};
      DB.tracking = {};

      saveDB();
      initDefaultTeacher();
      location.reload();
    }

    // ============ Init ============
    
    (async () => {
      // Attach event listeners first so the UI is responsive even if DB hangs
      document.getElementById('loginSubmitBtn').addEventListener('click', e => {
        e.preventDefault();
        login();
      });

      document.getElementById('logoutButton').addEventListener('click', logout);

      document.addEventListener('keypress', e => {
        if (e.key === 'Enter' && document.getElementById('dashboardPage').style.display === 'none') {
          e.preventDefault();
          login();
        }
      });

      document.getElementById('generalModal').addEventListener('click', function(e) {
        if (e.target === this) closeModal();
      });

      document.getElementById('examModal').addEventListener('click', function(e) {
        if (e.target === this) {
          if (examState.timeRemaining > 0) {
            if (confirm('هل تريد إغلاق الامتحان؟ لن يتم حفظ نتيجتك.')) {
              if (examState.timerInterval) clearInterval(examState.timerInterval);
              document.getElementById('examModal').classList.remove('show');
            }
          } else {
            document.getElementById('examModal').classList.remove('show');
          }
        }
      });

      document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
          closeModal();
        }
        if (e.key === 'PrintScreen') {
          e.preventDefault();
          showToast('السكرين شوت غير مسموح', 'error');
        }
        if (e.ctrlKey && e.key === 'p') {
          e.preventDefault();
        }
        if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) {
          e.preventDefault();
        }
        if (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j')) {
          e.preventDefault();
        }
        if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) {
          e.preventDefault();
        }
      });

      document.addEventListener('contextmenu', e => {
        if (e.target.closest('.modal-content') || e.target.closest('.exam-question') || e.target.closest('[id^="videoProtect"]')) {
          e.preventDefault();
        }
      });

      // Show loading overlay
      const loader = document.createElement('div');
      loader.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(255,255,255,0.9);z-index:9999;display:flex;justify-content:center;align-items:center;color:var(--gold);font-size:2rem;flex-direction:column;';
      loader.innerHTML = '<div class="spinner"></div><div style="margin-top:20px;color:var(--text-primary);">جاري تحميل البيانات...</div>';
      document.body.appendChild(loader);

      // Safety timeout - remove loader after 10s even if Firebase hangs
      const loaderTimeout = setTimeout(() => {
        if (document.body.contains(loader)) {
          document.body.removeChild(loader);
          showToast('تأخر الاتصال بالخادم. جرب تسجيل الدخول.', 'error');
        }
      }, 10000);

      try {
        const usersDoc = await db.collection('platform').doc('users').get();
        if(usersDoc.exists) {
            const d = usersDoc.data();
            DB.teachers = d.teachers || [];
            DB.students = d.students || [];
            DB.parents = d.parents || [];
        }
        const contentDoc = await db.collection('platform').doc('content').get();
        if(contentDoc.exists) DB.content = contentDoc.data();
        const examsDoc = await db.collection('platform').doc('exams').get();
        if(examsDoc.exists) DB.exams = examsDoc.data();
        const trackingDoc = await db.collection('platform').doc('tracking').get();
        if(trackingDoc.exists) DB.tracking = trackingDoc.data();
      } catch(e) {
          console.error("Error loading DB from Firebase:", e);
      }

      clearTimeout(loaderTimeout);
      if (document.body.contains(loader)) {
        document.body.removeChild(loader);
      }
      initDefaultTeacher();
    })();
  
// Expose to window
window.selectExamOption = selectExamOption;
window.goToQuestion = goToQuestion;
window.deleteItem = deleteItem;
window.removeQ = removeQ;
window.saveVideo = saveVideo;
window.previewExam = previewExam;
window.setupDragDrop = setupDragDrop;
window.genAccounts = genAccounts;
window.renderExams = renderExams;
window.logout = logout;
window.saveExam = saveExam;
window.submitExam = submitExam;
window.extractYouTubeId = extractYouTubeId;
window.showToast = showToast;
window.formatSize = formatSize;
window.nextQuestion = nextQuestion;
window.importData = importData;
window.login = login;
window.buildSidebar = buildSidebar;
window.clearAllData = clearAllData;
window.uploadPDF = uploadPDF;
window.renderExamQuestion = renderExamQuestion;
window.loadOverview = loadOverview;
window.validateEmail = validateEmail;
window.getContentCountByStage = getContentCountByStage;
window.handlePdf = handlePdf;
window.uploadFile = uploadFile;
window.startExam = startExam;
window.navigate = navigate;
window.downloadItem = downloadItem;
window.loadSection = loadSection;
window.addStudent = addStudent;
window.loadStudentContentView = loadStudentContentView;
window.fileToBase64 = fileToBase64;
window.editContentItem = editContentItem;
window.copyCredentials = copyCredentials;
window.closeExamModal = closeExamModal;
window.saveEditContent = saveEditContent;
window.addVideo = addVideo;
window.loadStudentProgress = loadStudentProgress;window.showBackupModal = showBackupModal;
window.addQ = addQ;
window.exportData = exportData;
window.handleFile = handleFile;
window.loadStudentExamsView = loadStudentExamsView;
window.viewStudentTracking = viewStudentTracking;
window.playVideo = playVideo;
window.prevQuestion = prevQuestion;
window.loadStudentsManager = loadStudentsManager;
window.renderStudentsTable = renderStudentsTable;
window.renderContent = renderContent;
window.generatePassword = generatePassword;
window.toggleSidebar = toggleSidebar;
window.delStudent = delStudent;
window.showModal = showModal;
window.formatTime = formatTime;
window.viewCred = viewCred;
window.loadStudentMyExams = loadStudentMyExams;
window.loadContentManager = loadContentManager;
window.getStageName = getStageName;
window.deleteExam = deleteExam;
window.validateField = validateField;
window.generateUsername = generateUsername;
window.closeModal = closeModal;
window.loadTracking = loadTracking;
window.loadExamsManager = loadExamsManager;
window.initDefaultTeacher = initDefaultTeacher;
window.updateTimerDisplay = updateTimerDisplay;
window.formatDate = formatDate;
window.createExam = createExam;
window.renderStudentContent = renderStudentContent;
window.editExamQs = editExamQs;

window.savePDF = savePDF;
window.saveFile = saveFile;

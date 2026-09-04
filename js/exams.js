// ============ Exams Management (Teacher) ============
let _currentExamStage = 'prep1';
let _examsPage = 1;

function loadExamsManager() {
  _examsPage = 1;
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
    <div id="examsPagination"></div>
  `;

  document.querySelectorAll('#examStageTabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      document.querySelectorAll('#examStageTabs .tab-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      _examsPage = 1;
      renderExams();
    });
  });

  renderExams();
}

function renderExams() {
  const activeStage = document.querySelector('#examStageTabs .tab-btn.active')?.dataset?.stage || 'prep1';
  _currentExamStage = activeStage;
  const exams = DB.exams[activeStage] || [];

  // Paginate
  const pagination = paginate(exams, _examsPage, PAGINATION.examsPerPage);

  const grid = document.getElementById('examGrid');
  if (!grid) return;

  if (pagination.items.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-file-alt"></i>
        <p>لا توجد امتحانات في ${getStageName(activeStage)}</p>
      </div>
    `;
    renderPagination('examsPagination', pagination, 'goToExamsPage');
    return;
  }

  const startIndex = (pagination.currentPage - 1) * PAGINATION.examsPerPage;

  grid.innerHTML = pagination.items.map((exam, i) => `
    <div class="exam-card">
      <div style="text-align:center;font-size:3rem;margin-bottom:10px;">📝</div>
      <h4>${Security.escapeHtml(exam.title)}</h4>
      <p style="color:var(--text-secondary);">${Security.escapeHtml(exam.description || '')}</p>
      <p style="margin-top:8px;">
        <span class="badge badge-info">${exam.questions.length} سؤال</span>
        <span class="badge">${exam.duration} دقيقة</span>
      </p>
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-sm btn-info" onclick="editExamQs('${activeStage}',${startIndex + i})">
          <i class="fas fa-edit"></i> تعديل
        </button>
        <button class="btn btn-sm btn-success" onclick="previewExam('${activeStage}',${startIndex + i})">
          <i class="fas fa-eye"></i> معاينة
        </button>
        <button class="btn btn-sm btn-danger" onclick="confirmDeleteExam('${activeStage}',${startIndex + i})">
          <i class="fas fa-trash"></i> حذف
        </button>
      </div>
    </div>
  `).join('');

  renderPagination('examsPagination', pagination, 'goToExamsPage');
}

function goToExamsPage(page) {
  _examsPage = page;
  renderExams();
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
  const t = document.getElementById('examTitle')?.value?.trim() || '';
  const d = document.getElementById('examDesc')?.value?.trim() || '';
  const dur = parseInt(document.getElementById('examDur')?.value) || 60;

  if (!t || t.length < 3) {
    showToast('يجب إدخال اسم الامتحان (3 أحرف على الأقل)', 'error');
    return;
  }

  let activeStage = _currentExamStage || 'prep1';
  const activeTab = document.querySelector('#examStageTabs .tab-btn.active');
  if (activeTab) activeStage = activeTab.dataset.stage || 'prep1';

  if (!DB.exams[activeStage]) DB.exams[activeStage] = [];

  const exam = {
    id: Security.generateId('exam'),
    title: t,
    description: d,
    duration: dur,
    questions: [],
    createdAt: new Date().toISOString()
  };
  DB.exams[activeStage].push(exam);
  saveDB('exams');
  closeModal();
  editExamQs(activeStage, DB.exams[activeStage].length - 1);
}

function editExamQs(stageId, examIndex) {
  const exam = DB.exams[stageId][examIndex];
  if (!exam) return;

  showModal(`تعديل أسئلة: ${exam.title}`, `
    <div id="qsList">
      ${exam.questions.length === 0 ? '<p style="color:var(--text-secondary);text-align:center;padding:20px;">لا توجد أسئلة بعد. أضف السؤال الأول أدناه.</p>' : ''}
      ${exam.questions.map((q, qi) => `
        <div class="question-item">
          <div style="display:flex;justify-content:space-between;align-items:start;">
            <h4 style="color:var(--gold);">سؤال ${qi + 1}</h4>
            <button class="btn btn-sm btn-danger" onclick="removeQ('${stageId}',${examIndex},${qi})">
              <i class="fas fa-trash"></i>
            </button>
          </div>
          <p style="margin:8px 0;"><strong>${Security.escapeHtml(q.text)}</strong></p>
          ${q.questionImage ? `<img src="${q.questionImage}" style="max-width:100%;border-radius:10px;margin:10px 0;border:1px solid var(--border-color);">` : ''}
          ${q.options.map((o, oi) => `
            <div class="option-item ${oi === q.correctAnswer ? 'correct' : ''}">
              ${oi + 1}. ${Security.escapeHtml(o)}
              ${q.optionImages && q.optionImages[oi] ? `<img src="${q.optionImages[oi]}" style="max-width:120px;border-radius:8px;margin-right:10px;">` : ''}
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
        <textarea class="form-control" id="qText" placeholder="اكتب السؤال هنا... (اختياري لو هتضيف صورة)"></textarea>
      </div>
      <div class="form-group">
        <label>صورة السؤال (اختياري)</label>
        <input type="file" class="form-control" id="qImage" accept="image/*" style="padding:10px;">
        <div id="qImagePreview" style="margin-top:5px;"></div>
      </div>
      <div class="form-group">
        <label>الخيارات (2-4 خيارات) - كل خيار ممكن يكون نص أو صورة أو الاتنين</label>
        <div id="optionsContainer">
          <div class="option-row" style="display:flex;gap:8px;align-items:center;margin-bottom:5px;">
            <input class="form-control qOpt" placeholder="الخيار الصحيح" style="flex:1;">
            <label class="btn btn-sm btn-outline" style="white-space:nowrap;cursor:pointer;">
              <i class="fas fa-image"></i> صورة
              <input type="file" accept="image/*" class="qOptImg" style="display:none;">
            </label>
          </div>
          <div class="option-row" style="display:flex;gap:8px;align-items:center;margin-bottom:5px;">
            <input class="form-control qOpt" placeholder="الخيار الثاني" style="flex:1;">
            <label class="btn btn-sm btn-outline" style="white-space:nowrap;cursor:pointer;">
              <i class="fas fa-image"></i> صورة
              <input type="file" accept="image/*" class="qOptImg" style="display:none;">
            </label>
          </div>
        </div>
        <button class="btn btn-sm btn-outline" onclick="addOptionRow()" style="margin-top:5px;">
          <i class="fas fa-plus"></i> إضافة خيار
        </button>
      </div>
      <div class="form-group">
        <label>رقم الإجابة الصحيحة (1-4)</label>
        <input type="number" class="form-control" id="qCorrect" min="1" max="4" value="1">
      </div>
      <button class="btn btn-gold btn-block" id="addQBtn" onclick="addQ('${stageId}',${examIndex})">
        <i class="fas fa-plus"></i> إضافة السؤال
      </button>
    </div>
    <button class="btn btn-success btn-block" style="margin-top:15px;" onclick="closeModal();renderExams();">
      <i class="fas fa-check"></i> إنهاء التعديل
    </button>
  `);
}

function addOptionRow() {
  const container = document.getElementById('optionsContainer');
  const count = container.querySelectorAll('.option-row').length;
  if (count >= 4) { showToast('الحد الأقصى 4 خيارات', 'error'); return; }
  const labels = ['الخيار الثالث', 'الخيار الرابع'];
  const row = document.createElement('div');
  row.className = 'option-row';
  row.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:5px;';
  row.innerHTML = `
    <input class="form-control qOpt" placeholder="${labels[count - 2] || 'خيار'}" style="flex:1;">
    <label class="btn btn-sm btn-outline" style="white-space:nowrap;cursor:pointer;">
      <i class="fas fa-image"></i> صورة
      <input type="file" accept="image/*" class="qOptImg" style="display:none;">
    </label>
    <button class="btn btn-sm btn-danger" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
  `;
  container.appendChild(row);
}

async function addQ(stageId, examIndex) {
  const text = document.getElementById('qText').value.trim();
  const optEls = document.querySelectorAll('#optionsContainer .option-row');
  const imgEls = document.querySelectorAll('.qOptImg');
  const correct = parseInt(document.getElementById('qCorrect').value) - 1;
  const qImgFile = document.getElementById('qImage').files[0];

  if (!text && !qImgFile) { showToast('أدخل نص السؤال أو صورة', 'error'); return; }
  if (optEls.length < 2) { showToast('أدخل خيارين على الأقل', 'error'); return; }
  if (correct < 0 || correct >= optEls.length) { showToast('رقم الإجابة غير صحيح', 'error'); return; }

  const btn = document.getElementById('addQBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الرفع...';

  let questionImage = null;
  if (qImgFile) {
    try {
      const r = await uploadToCloudinary(qImgFile, stageId);
      if (r && r.url) questionImage = r.url;
      else throw new Error(r?.error || 'فشل رفع صورة السؤال');
    } catch (e) {
      console.error('Question image upload error:', e);
      showToast('فشل رفع صورة السؤال: ' + e.message, 'error');
    }
  }

  const opts = [];
  const optionImages = [];
  let hasOptionImages = false;
  for (let i = 0; i < optEls.length; i++) {
    const val = optEls[i].querySelector('.qOpt').value.trim();
    opts.push(val);
    const imgFile = optEls[i].querySelector('.qOptImg')?.files[0];
    if (imgFile) {
      try {
        const r = await uploadToCloudinary(imgFile, stageId);
        if (r && r.url) {
          optionImages[i] = r.url;
          hasOptionImages = true;
        }
      } catch (e) {
        console.error('Option image upload error:', e);
        showToast('فشل رفع صورة الخيار: ' + e.message, 'error');
        optionImages[i] = null;
      }
    }
  }

  const validOpts = opts.filter(v => v);
  if (validOpts.length < 2 && !hasOptionImages) {
    showToast('أدخل خيارين على الأقل', 'error');
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-plus"></i> إضافة السؤال';
    return;
  }

  const question = {
    id: Security.generateId('q'),
    text: text,
    options: opts,
    correctAnswer: correct
  };
  if (questionImage) question.questionImage = questionImage;
  if (hasOptionImages) question.optionImages = optionImages;

  DB.exams[stageId][examIndex].questions.push(question);
  saveDB('exams');
  btn.disabled = false;
  btn.innerHTML = '<i class="fas fa-plus"></i> إضافة السؤال';
  editExamQs(stageId, examIndex);
  showToast('تمت إضافة السؤال!');
}

function removeQ(stageId, examIndex, qIndex) {
  showConfirm('حذف هذا السؤال؟', () => {
    DB.exams[stageId][examIndex].questions.splice(qIndex, 1);
    saveDB('exams');
    editExamQs(stageId, examIndex);
    showToast('تم الحذف');
  });
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
        ${q.questionImage ? `<img src="${q.questionImage}" style="max-width:100%;border-radius:10px;margin:10px 0;">` : ''}
        ${q.options.map((o, oi) => `
          <div class="option-item ${oi === q.correctAnswer ? 'correct' : ''}">
            ${Security.escapeHtml(o)}
            ${q.optionImages && q.optionImages[oi] ? `<img src="${q.optionImages[oi]}" style="max-width:120px;border-radius:8px;margin-right:10px;">` : ''}
            ${oi === q.correctAnswer ? ' <i class="fas fa-check-circle" style="color:var(--success);margin-right:auto;"></i>' : ''}
          </div>
        `).join('')}
      </div>
    `;
  });

  showModal(`معاينة: ${exam.title}`, html);
}

function confirmDeleteExam(stageId, examIndex) {
  const exam = DB.exams[stageId][examIndex];
  if (!exam) return;
  showConfirm(`هل أنت متأكد من حذف امتحان "${exam.title}"؟`, () => {
    deleteExam(stageId, examIndex);
  });
}

function deleteExam(stageId, examIndex) {
  DB.exams[stageId].splice(examIndex, 1);
  saveDB('exams');
  renderExams();
  showToast('تم الحذف');
}

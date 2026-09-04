// ============ Student/Parent: Content View ============
function loadStudentContentView() {
  const eff = getEffectiveUser();
  const grade = eff.grade;
  const allItems = getAllStageItems(grade);
  const catCounts = {};
  CATEGORIES.forEach(cat => catCounts[cat] = 0);
  allItems.forEach(item => { if (catCounts[item.category] !== undefined) catCounts[item.category]++; });

  document.getElementById('dashboardContent').innerHTML = `
    <h2 style="color: var(--gold); margin-bottom: 25px;">
      <i class="fas fa-book-open"></i> المحتوى التعليمي - ${getStageName(grade)}${currentUser.role === 'parent' ? ` (${Security.escapeHtml(eff.name)})` : ''}
    </h2>
    <div class="tabs" id="studentCategoryTabs">
      <button class="tab-btn active" data-category="all">الكل (${allItems.length})</button>
      ${CATEGORIES.map(cat => `<button class="tab-btn" data-category="${cat}"><i class="fas ${CATEGORY_ICONS[cat]}"></i> ${CATEGORY_NAMES[cat]} (${catCounts[cat]})</button>`).join('')}
    </div>
    <div class="search-bar">
      <input type="text" class="form-control" placeholder="بحث في المحتوى..." id="studentContentSearch" oninput="renderStudentContent()">
    </div>
    <div class="lesson-grid" id="studentContentGrid"></div>
  `;

  document.querySelectorAll('#studentCategoryTabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      document.querySelectorAll('#studentCategoryTabs .tab-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      renderStudentContent();
    });
  });

  renderStudentContent();
}

function renderStudentContent() {
  const eff = getEffectiveUser();
  const grade = eff.grade;
  const search = (document.getElementById('studentContentSearch')?.value || '').toLowerCase();
  const activeCategory = document.querySelector('#studentCategoryTabs .tab-btn.active')?.dataset?.category || 'all';
  let items = getAllStageItems(grade);

  if (activeCategory !== 'all') {
    items = items.filter(i => i.category === activeCategory);
  }

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

    const catName = CATEGORY_NAMES[item.category] || item.category;
    const isWatched = item.type === 'video' && item.videoId && tracking.videoProgress[item.videoId]?.watched;
    const isCompleted = item.type !== 'video' && tracking.completedLessons.includes(item.id);
    const statusBadge = isWatched ? '<span class="badge badge-success" style="margin-right:5px;"><i class="fas fa-check"></i> تم المشاهدة</span>' :
      isCompleted ? '<span class="badge badge-success" style="margin-right:5px;"><i class="fas fa-check"></i> تم التحميل</span>' : '';

    return `
      <div class="content-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span class="badge ${badgeClass}">${badgeText}</span>
          <span class="badge" style="background:var(--input-bg);color:var(--text-primary);">${catName}</span>
        </div>
        ${statusBadge}
        <div style="text-align:center;margin:15px 0;">${icon}</div>
        <h4>${Security.escapeHtml(item.title)}</h4>
        <p style="color:var(--text-secondary);font-size:0.9rem;">${Security.escapeHtml(item.description || '')}</p>
        <p style="font-size:0.8rem;color:var(--text-secondary);margin-top:8px;">
          <i class="fas fa-calendar"></i> ${formatDate(item.date)}
        </p>
        <div style="margin-top:12px;display:flex;gap:8px;">
          ${item.type === 'video' ?
            `<button class="btn btn-info btn-block" onclick="playVideo('${item.videoId}','${Security.escapeHtml(item.title).replace(/'/g, "\\'")}')"><i class="fas fa-play"></i> مشاهدة</button>` :
            `<button class="btn btn-info" style="flex:1;" onclick="downloadItem('${item.stageId}','${item.id}')"><i class="fas fa-eye"></i> مشاهدة</button>
             <a href="${item.fileUrl || '#'}" target="_blank" download="${Security.escapeHtml(item.fileName || item.title)}" class="btn btn-success" style="flex:0 0 auto;" title="تحميل"><i class="fas fa-download"></i></a>`
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

  showConfirm(`هل أنت مستعد لبدء امتحان "${exam.title}"?\nالمدة: ${exam.duration} دقيقة\nعدد الأسئلة: ${exam.questions.length}`, () => {
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
  });
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
      ${q.questionImage ? `<img src="${q.questionImage}" style="max-width:100%;border-radius:10px;margin:10px 0;">` : ''}
      <div id="examOptions">
        ${q.options.map((o, oi) => `
          <div class="option-item ${examState.answers[qi] === oi ? 'selected' : ''}" onclick="selectExamOption(${qi}, ${oi})">
            <span style="font-weight:bold;min-width:25px;">${oi + 1}.</span>
            <span>${Security.escapeHtml(o)}</span>
            ${q.optionImages && q.optionImages[oi] ? `<img src="${q.optionImages[oi]}" style="max-width:150px;border-radius:8px;margin-right:auto;">` : ''}
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

  const effId = getEffectiveUser().id;
  if (!DB.tracking[effId]) {
    DB.tracking[effId] = { completedLessons: [], videoProgress: {}, examScores: {} };
  }
  DB.tracking[effId].examScores[exam.id] = score;
  saveDB('tracking');

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
              ${q.questionImage ? `<img src="${q.questionImage}" style="max-width:100%;border-radius:10px;margin:10px 0;">` : ''}
              ${q.options.map((o, oi) => {
                let cls = '';
                if (oi === q.correctAnswer) cls = 'correct';
                else if (oi === userAnswer && !isCorrect) cls = 'wrong';
                return `
                  <div class="option-item ${cls}">
                    ${oi + 1}. ${Security.escapeHtml(o)}
                    ${q.optionImages && q.optionImages[oi] ? `<img src="${q.optionImages[oi]}" style="max-width:120px;border-radius:8px;margin-right:10px;">` : ''}
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
  const allContent = getAllStageItems(grade);
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

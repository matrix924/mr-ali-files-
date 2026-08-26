// ============ Overview ============
function loadOverview() {
  let totalContent = getAllContentItems().length;
  let totalExams = 0;
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
          <div class="stat-value">${getAllStageItems(effectiveGrade).length}</div>
          <div class="stat-label"><i class="fas fa-book-open"></i> محتوى متاح</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${(DB.exams[effectiveGrade] || []).length}</div>
          <div class="stat-label"><i class="fas fa-file-alt"></i> امتحان متاح</div>
        </div>
        ${isParent && linkedStudent ? (() => {
          const tracking = DB.tracking[linkedStudent.id] || { examScores: {}, completedLessons: [] };
          const scores = Object.values(tracking.examScores);
          const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
          const total = getAllStageItems(linkedStudent.grade).length;
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

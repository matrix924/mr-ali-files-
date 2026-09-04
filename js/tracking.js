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
    const totalLessons = getAllStageItems(student.grade).length;
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
                ${Object.entries(tracking.examScores).map(([examId, score]) => {
                  let examTitle = examId;
                  const gradeExams = DB.exams[student.grade] || [];
                  const foundExam = gradeExams.find(e => e.id === examId);
                  if (foundExam) examTitle = foundExam.title;
                  return `
                  <tr>
                    <td>${Security.escapeHtml(examTitle)}</td>
                    <td><strong>${score}%</strong></td>
                    <td>
                      <span class="badge ${score >= 70 ? 'badge-success' : score >= 50 ? 'badge-warning' : 'badge-danger'}">
                        ${score >= 70 ? 'ناجح' : score >= 50 ? 'متوسط' : 'راسب'}
                      </span>
                    </td>
                  </tr>
                `;}).join('')}
              </tbody>
            </table>
          </div>
        ` : '<p style="color:var(--text-secondary);margin-top:10px;">لم يتم حل أي امتحان بعد</p>'}
      </div>
    `;
  });

  document.getElementById('dashboardContent').innerHTML = html;
}

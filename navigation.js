// ============ Sidebar & Navigation ============
function buildSidebar() {
  const menu = document.getElementById('sidebarMenu');
  const isTeacher = currentUser.role === 'teacher';
  const isParent = currentUser.role === 'parent';

  const items = [
    { section: 'overview', icon: 'fa-home', label: 'الرئيسية', show: true },
    { section: 'content', icon: 'fa-book-open', label: 'المحتوى التعليمي', show: true },
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

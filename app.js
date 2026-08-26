// ============ Splash Screen ============
(function () {
  const splash = document.getElementById('splashScreen');
  if (!splash) return;
  setTimeout(() => {
    splash.style.transition = 'opacity 0.6s ease';
    splash.style.opacity = '0';
    setTimeout(() => { splash.style.display = 'none'; }, 600);
  }, 2500);
})();

// ============ Init ============
(async function () {
  API.init(APPS_SCRIPT_URL);

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

  document.getElementById('generalModal').addEventListener('click', function (e) {
    if (e.target === this) closeModal();
  });

  document.getElementById('examModal').addEventListener('click', function (e) {
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
    if (e.key === 'Escape') closeModal();
    if (e.key === 'PrintScreen') { e.preventDefault(); showToast('السكرين شوت غير مسموح', 'error'); }
    if (e.ctrlKey && e.key === 'p') e.preventDefault();
    if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) e.preventDefault();
    if (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j')) e.preventDefault();
    if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) e.preventDefault();
  });

  document.addEventListener('contextmenu', e => {
    if (e.target.closest('.modal-content') || e.target.closest('.exam-question') || e.target.closest('[id^="videoProtect"]')) {
      e.preventDefault();
    }
  });

  // Show loading
  const loader = document.createElement('div');
  loader.id = 'initLoader';
  loader.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(255,255,255,0.9);z-index:9999;display:flex;justify-content:center;align-items:center;flex-direction:column;';
  loader.innerHTML = '<div class="spinner"></div><div style="margin-top:20px;color:#333;font-size:1.2rem;" id="initStatus">جاري تحميل البيانات...</div>';
  document.body.appendChild(loader);

  const loaderTimeout = setTimeout(() => {
    const el = document.getElementById('initLoader');
    if (el) el.remove();
    const status = document.getElementById('initStatus');
    if (status) status.textContent = '';
  }, 15000);

  // Load data (with fallback)
  const apiOk = await loadDBFromAPI();

  clearTimeout(loaderTimeout);
  const el = document.getElementById('initLoader');
  if (el) el.remove();

  if (!apiOk && !DB.teachers.length) {
    showToast('تعذر الاتصال بالخادم - سيعمل التطبيق بدون حفظ', 'warning');
  }

  // Init default teacher
  await initDefaultTeacher();
})();

// ============ Expose to window ============
window.login = login;
window.logout = logout;
window.navigate = navigate;
window.loadSection = loadSection;
window.showModal = showModal;
window.closeModal = closeModal;
window.showToast = showToast;
window.copyCredentials = copyCredentials;
window.copyAllCredentials = copyAllCredentials;
window.genAccounts = genAccounts;
window.addStudent = addStudent;
window.delStudent = delStudent;
window.viewCred = viewCred;
window.renderStudentsTable = renderStudentsTable;
window.loadStudentsManager = loadStudentsManager;
window.createExam = createExam;
window.saveExam = saveExam;
window.addQ = addQ;
window.removeQ = removeQ;
window.editExamQs = editExamQs;
window.previewExam = previewExam;
window.deleteExam = deleteExam;
window.renderExams = renderExams;
window.loadExamsManager = loadExamsManager;
window.addVideo = addVideo;
window.saveVideo = saveVideo;
window.uploadPDF = uploadPDF;
window.savePDF = savePDF;
window.uploadFile = uploadFile;
window.saveFile = saveFile;
window.handlePdf = handlePdf;
window.handleFile = handleFile;
window.renderContent = renderContent;
window.loadContentManager = loadContentManager;
window.editContentItem = editContentItem;
window.saveEditContent = saveEditContent;
window.deleteItem = deleteItem;
window.downloadItem = downloadItem;
window.loadOverview = loadOverview;
window.loadTracking = loadTracking;
window.loadStudentProgress = loadStudentProgress;
window.viewStudentTracking = viewStudentTracking;
window.loadStudentContentView = loadStudentContentView;
window.loadStudentExamsView = loadStudentExamsView;
window.startExam = startExam;
window.submitExam = submitExam;
window.selectExamOption = selectExamOption;
window.nextQuestion = nextQuestion;
window.prevQuestion = prevQuestion;
window.goToQuestion = goToQuestion;
window.closeExamModal = closeExamModal;
window.updateTimerDisplay = updateTimerDisplay;
window.playVideo = playVideo;
window.toggleSidebar = toggleSidebar;
window.buildSidebar = buildSidebar;
window.showBackupModal = showBackupModal;
window.exportData = exportData;
window.importData = importData;
window.clearAllData = clearAllData;
window.generatePassword = generatePassword;
window.generateUsername = generateUsername;
window.validateField = validateField;
window.validateEmail = validateEmail;
window.extractYouTubeId = extractYouTubeId;
window.formatSize = formatSize;
window.formatTime = formatTime;
window.formatDate = formatDate;
window.getStageName = getStageName;
window.getContentCountByStage = getContentCountByStage;
window.getAllStageItems = getAllStageItems;
window.getAllContentItems = getAllContentItems;
window.addOptionRow = addOptionRow;
window.setupDragDrop = setupDragDrop;
window.initDefaultTeacher = initDefaultTeacher;
window.CATEGORY_NAMES = CATEGORY_NAMES;
window.CATEGORY_ICONS = CATEGORY_ICONS;

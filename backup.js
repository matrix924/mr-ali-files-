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
    version: '4.0'
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
  reader.onload = function (e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.version) throw new Error('ملف غير صالح');

      if (!confirm('سيتم استبدال جميع البيانات الحالية. هل أنت متأكد؟')) return;

      DB.teachers = data.teachers || DB.teachers;
      DB.students = data.students || [];
      DB.parents = data.parents || [];
      DB.content = data.content ? migrateContent(data.content) : DB.content;
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
  DB.content = createEmptyContent();
  DB.exams = { prep1: [], prep2: [], prep3: [], sec1: [], sec2: [], sec3: [] };
  DB.tracking = {};

  saveDB();
  initDefaultTeacher();
  location.reload();
}

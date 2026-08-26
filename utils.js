// ============ Utility Functions ============
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = type === 'success' ? 'var(--success)' : type === 'info' ? 'var(--info)' : 'var(--danger)';
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

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function setupDragDrop(dropAreaId, inputId) {
  const dropArea = document.getElementById(dropAreaId);
  const input = document.getElementById(inputId);
  if (!dropArea || !input) return;

  dropArea.addEventListener('click', () => input.click());

  dropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropArea.classList.add('dragover');
  });

  dropArea.addEventListener('dragleave', () => {
    dropArea.classList.remove('dragover');
  });

  dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    dropArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      input.files = files;
      input.dispatchEvent(new Event('change'));
    }
  });
}

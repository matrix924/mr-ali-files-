// ============ Utility Functions ============

// ============ UI Helpers ============
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  if (!t) return;

  const colors = {
    success: 'var(--success)',
    error: 'var(--danger)',
    info: 'var(--info)',
    warning: 'var(--warning)'
  };

  t.textContent = msg;
  t.style.background = colors[type] || colors.success;
  t.style.color = 'white';
  t.style.display = 'block';
  clearTimeout(t._timeout);
  t._timeout = setTimeout(() => t.style.display = 'none', 3000);
}

function showModal(title, content) {
  const modal = document.getElementById('generalModal');
  const modalContent = document.getElementById('modalContent');
  if (!modal || !modalContent) return;

  modalContent.innerHTML = `
    <div class="modal-header">
      <h3>${Security.escapeHtml(title)}</h3>
      <button class="modal-close" onclick="closeModal()">&times;</button>
    </div>
    ${content}
  `;
  modal.classList.add('show');
}

function closeModal() {
  const modal = document.getElementById('generalModal');
  if (modal) modal.classList.remove('show');
}

function showLoading(container, message = 'جاري التحميل...') {
  if (typeof container === 'string') {
    container = document.getElementById(container);
  }
  if (!container) return;

  container.innerHTML = `
    <div class="loading">
      <div style="text-align:center;">
        <div class="spinner"></div>
        <p style="margin-top:15px;color:var(--text-secondary);">${message}</p>
      </div>
    </div>
  `;
}

function hideLoading(container) {
  if (typeof container === 'string') {
    container = document.getElementById(container);
  }
  // Loading will be replaced by actual content
}

// ============ Format Helpers ============
function getStageName(id) {
  return STAGE_NAMES[id] || id;
}

function formatSize(bytes) {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + units[i];
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

// ============ Validation Helpers ============
function extractYouTubeId(url) {
  if (!url || typeof url !== 'string') return null;
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

function validateField(value, fieldName, minLength = 1) {
  if (!value || value.trim().length < minLength) {
    showToast(`يجب إدخال ${fieldName} (${minLength} أحرف على الأقل)`, 'error');
    return false;
  }
  return true;
}

function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// ============ File Helpers ============
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

// ============ Pagination Helper ============
function paginate(array, page, perPage) {
  const startIndex = (page - 1) * perPage;
  const endIndex = startIndex + perPage;
  const items = array.slice(startIndex, endIndex);
  const totalPages = Math.ceil(array.length / perPage);

  return {
    items,
    currentPage: page,
    totalPages,
    totalItems: array.length,
    hasNext: page < totalPages,
    hasPrev: page > 1
  };
}

function renderPagination(containerId, paginationData, onPageChange) {
  const container = document.getElementById(containerId);
  if (!container || paginationData.totalPages <= 1) {
    if (container) container.innerHTML = '';
    return;
  }

  const { currentPage, totalPages } = paginationData;

  let html = '<div style="display:flex;justify-content:center;gap:8px;margin-top:20px;">';

  // Previous button
  if (currentPage > 1) {
    html += `<button class="btn btn-sm btn-outline" onclick="${onPageChange}(${currentPage - 1})">
      <i class="fas fa-arrow-right"></i> السابق
    </button>`;
  }

  // Page numbers
  const maxVisible = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);

  if (endPage - startPage + 1 < maxVisible) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  if (startPage > 1) {
    html += `<button class="btn btn-sm btn-outline" onclick="${onPageChange}(1)">1</button>`;
    if (startPage > 2) html += '<span style="padding:5px;">...</span>';
  }

  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="btn btn-sm ${i === currentPage ? 'btn-gold' : 'btn-outline'}"
      onclick="${onPageChange}(${i})">${i}</button>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) html += '<span style="padding:5px;">...</span>';
    html += `<button class="btn btn-sm btn-outline" onclick="${onPageChange}(${totalPages})">${totalPages}</button>`;
  }

  // Next button
  if (currentPage < totalPages) {
    html += `<button class="btn btn-sm btn-outline" onclick="${onPageChange}(${currentPage + 1})">
      التالي <i class="fas fa-arrow-left"></i>
    </button>`;
  }

  html += '</div>';
  container.innerHTML = html;
}

// ============ Confirm Dialog ============
function showConfirm(message, onConfirm, onCancel) {
  const modal = document.getElementById('generalModal');
  const modalContent = document.getElementById('modalContent');
  if (!modal || !modalContent) {
    if (confirm(message)) onConfirm();
    return;
  }

  modalContent.innerHTML = `
    <div class="modal-header">
      <h3>تأكيد</h3>
      <button class="modal-close" onclick="closeModal()">&times;</button>
    </div>
    <p style="margin-bottom:20px;line-height:1.8;">${Security.escapeHtml(message)}</p>
    <div style="display:flex;gap:10px;">
      <button class="btn btn-danger" style="flex:1;" id="confirmYesBtn">
        <i class="fas fa-check"></i> نعم
      </button>
      <button class="btn btn-outline" style="flex:1;" onclick="closeModal()">
        <i class="fas fa-times"></i> إلغاء
      </button>
    </div>
  `;

  document.getElementById('confirmYesBtn').addEventListener('click', () => {
    closeModal();
    onConfirm();
  });

  modal.classList.add('show');
}

// ============ Copy to Clipboard ============
function copyToClipboard(text, successMsg = 'تم النسخ!') {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(successMsg);
    }).catch(() => {
      fallbackCopy(text, successMsg);
    });
  } else {
    fallbackCopy(text, successMsg);
  }
}

function fallbackCopy(text, successMsg) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
    showToast(successMsg);
  } catch {
    showToast('لم يتم النسخ', 'error');
  }
  document.body.removeChild(textarea);
}

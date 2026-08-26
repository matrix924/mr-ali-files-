// ============ Content Management (Teacher) ============
function getContentCountByStage() {
  const counts = {};
  STAGES.forEach(s => counts[s] = getAllStageItems(s).length);
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
    <div class="tabs" id="categoryTabs" style="margin-bottom:15px;">
      <button class="tab-btn active" data-category="all">الكل</button>
      ${CATEGORIES.map(cat => `<button class="tab-btn" data-category="${cat}"><i class="fas ${CATEGORY_ICONS[cat]}"></i> ${CATEGORY_NAMES[cat]}</button>`).join('')}
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
    btn.addEventListener('click', function () {
      document.querySelectorAll('#stageTabs .tab-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      renderContent();
    });
  });

  document.querySelectorAll('#categoryTabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      document.querySelectorAll('#categoryTabs .tab-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      renderContent();
    });
  });

  document.querySelectorAll('#typeTabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      document.querySelectorAll('#typeTabs .tab-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      renderContent();
    });
  });

  renderContent();
}

function renderContent() {
  const activeStage = document.querySelector('#stageTabs .tab-btn.active')?.dataset?.stage || 'all';
  const activeCategory = document.querySelector('#categoryTabs .tab-btn.active')?.dataset?.category || 'all';
  const activeType = document.querySelector('#typeTabs .tab-btn.active')?.dataset?.type || 'all';
  const searchQuery = (document.getElementById('contentSearch')?.value || '').toLowerCase();
  let items = [];

  if (activeStage === 'all') {
    items = getAllContentItems();
  } else {
    items = getAllStageItems(activeStage);
  }

  if (activeCategory !== 'all') {
    items = items.filter(i => i.category === activeCategory);
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

    const catName = CATEGORY_NAMES[item.category] || item.category;
    const catIcon = CATEGORY_ICONS[item.category] || 'fa-folder';

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
          <i class="fas fa-graduation-cap"></i> ${getStageName(item.stageId)} | <i class="fas ${catIcon}"></i> ${catName}
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
            `<button class="btn btn-sm btn-info" onclick="downloadItem('${item.stageId}','${item.id}')"><i class="fas fa-eye"></i> مشاهدة</button>`
          }
          <button class="btn btn-sm btn-outline" onclick="editContentItem('${item.stageId}','${item.id}')"><i class="fas fa-edit"></i> تعديل</button>
          <button class="btn btn-sm btn-danger" onclick="deleteItem('${item.stageId}','${item.id}')"><i class="fas fa-trash"></i> حذف</button>
        </div>
      </div>
    `;
  }).join('');
}

function editContentItem(stageId, id) {
  const found = findItem(stageId, id);
  if (!found) return;
  const item = found.item;
  const currentCat = found.category;
  const isVideo = item.type === 'video';
  showModal('تعديل المحتوى', `
    <div class="form-group">
      <label>الصف الدراسي</label>
      <select class="form-control" id="editStage">
        ${STAGES.map(s => `<option value="${s}" ${s === stageId ? 'selected' : ''}>${getStageName(s)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>القسم</label>
      <select class="form-control" id="editCategory">
        ${CATEGORIES.map(c => `<option value="${c}" ${c === currentCat ? 'selected' : ''}>${CATEGORY_NAMES[c]}</option>`).join('')}
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
  const newCategory = document.getElementById('editCategory').value;
  const newTitle = document.getElementById('editTitle').value.trim();
  const newDesc = document.getElementById('editDesc').value.trim();

  if (!validateField(newTitle, 'العنوان', 3)) return;

  const found = findItem(oldStageId, id);
  if (!found) return;

  const oldCat = found.category;
  const item = found.item;
  item.title = newTitle;
  item.description = newDesc;
  item.category = newCategory;

  if (type === 'video') {
    const newUrl = document.getElementById('editUrl').value.trim();
    if (newUrl) {
      const vid = extractYouTubeId(newUrl);
      if (!vid) { showToast('رابط يوتيوب غير صالح', 'error'); return; }
      item.url = newUrl;
      item.videoId = vid;
    }
  }

  if (newStage !== oldStageId || newCategory !== oldCat) {
    DB.content[oldStageId][oldCat] = DB.content[oldStageId][oldCat].filter(c => c.id !== id);
    item.stageId = newStage;
    if (!DB.content[newStage][newCategory]) DB.content[newStage][newCategory] = [];
    DB.content[newStage][newCategory].push(item);
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
      <label>القسم</label>
      <select class="form-control" id="vCategory">
        ${CATEGORIES.map(c => `<option value="${c}">${CATEGORY_NAMES[c]}</option>`).join('')}
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
  const c = document.getElementById('vCategory').value;
  const t = document.getElementById('vTitle').value.trim();
  const u = document.getElementById('vUrl').value.trim();
  const d = document.getElementById('vDesc').value.trim();

  if (!validateField(t, 'العنوان', 3)) return;
  if (!validateField(u, 'الرابط', 10)) return;

  const vid = extractYouTubeId(u);
  if (!vid) { showToast('رابط يوتيوب غير صالح', 'error'); return; }

  if (!DB.content[s][c]) DB.content[s][c] = [];
  DB.content[s][c].push({
    id: 'v_' + Date.now(),
    stageId: s,
    category: c,
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
      <label>القسم</label>
      <select class="form-control" id="pCategory">
        ${CATEGORIES.map(c => `<option value="${c}">${CATEGORY_NAMES[c]}</option>`).join('')}
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
        <p class="form-hint">الحد الأقصى: 200MB</p>
        <input type="file" id="pdfInp" accept=".pdf" style="display:none" onchange="handlePdf(this)">
      </div>
      <div id="pdfInfo"></div>
    </div>
    <button class="btn btn-gold btn-block" onclick="savePDF()"><i class="fas fa-upload"></i> رفع</button>
  `);
  window._pdf = null;
  setupDragDrop('pdfDropArea', 'pdfInp');
}

function handlePdf(inp) {
  const f = inp.files[0];
  if (f) {
    if (f.size > 200 * 1024 * 1024) {
      showToast('حجم الملف يتجاوز 200MB', 'error');
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
  const c = document.getElementById('pCategory').value;
  const t = document.getElementById('pTitle').value.trim();
  const d = document.getElementById('pDesc').value.trim();

  if (!validateField(t, 'العنوان', 3)) return;
  if (!window._pdf) { showToast('اختر ملف PDF', 'error'); return; }

  const btn = document.querySelector('#generalModal .btn-gold');
  const origText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الرفع...';

  try {
    const fileId = 'pdf_' + Date.now();
    const result = await uploadToCloudinary(window._pdf, s);

    if (!DB.content[s][c]) DB.content[s][c] = [];
    DB.content[s][c].push({
      id: fileId,
      stageId: s,
      category: c,
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
  } finally {
    btn.disabled = false;
    btn.innerHTML = origText;
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
      <label>القسم</label>
      <select class="form-control" id="fCategory">
        ${CATEGORIES.map(c => `<option value="${c}">${CATEGORY_NAMES[c]}</option>`).join('')}
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
        <p class="form-hint">Word, PowerPoint, Excel, صور | الحد الأقصى: 200MB</p>
        <input type="file" id="fileInp" accept=".doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.gif" style="display:none" onchange="handleFile(this)">
      </div>
      <div id="fileInfo"></div>
    </div>
    <button class="btn btn-gold btn-block" onclick="saveFile()"><i class="fas fa-upload"></i> رفع</button>
  `);
  window._file = null;
  setupDragDrop('fileDropArea', 'fileInp');
}

function handleFile(inp) {
  const f = inp.files[0];
  if (f) {
    if (f.size > 200 * 1024 * 1024) {
      showToast('حجم الملف يتجاوز 200MB', 'error');
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
  const c = document.getElementById('fCategory').value;
  const t = document.getElementById('fTitle').value.trim();
  const d = document.getElementById('fDesc').value.trim();

  if (!validateField(t, 'العنوان', 3)) return;
  if (!window._file) { showToast('اختر ملف', 'error'); return; }

  const btn = document.querySelector('#generalModal .btn-gold');
  const origText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الرفع...';

  try {
    const fileId = 'file_' + Date.now();
    const result = await uploadToCloudinary(window._file, s);

    if (!DB.content[s][c]) DB.content[s][c] = [];
    DB.content[s][c].push({
      id: fileId,
      stageId: s,
      category: c,
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
  } finally {
    btn.disabled = false;
    btn.innerHTML = origText;
  }
}

function playVideo(videoId, title) {
  const eff = getEffectiveUser();
  const studentName = eff ? eff.name : 'طالب';
  const watermarkId = 'wm_' + Date.now();

  showModal(title, `
    <div id="videoProtect_${watermarkId}" style="position:relative;">
      <div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:10px;">
        <iframe src="https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1"
          style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;"
          allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
        </iframe>
      </div>
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

  if (eff && eff.id && videoId) {
    if (!DB.tracking[eff.id]) {
      DB.tracking[eff.id] = { completedLessons: [], videoProgress: {}, examScores: {} };
    }
    if (!DB.tracking[eff.id].videoProgress) DB.tracking[eff.id].videoProgress = {};
    if (!DB.tracking[eff.id].videoProgress[videoId]) {
      DB.tracking[eff.id].videoProgress[videoId] = { watched: true, date: new Date().toISOString() };
    } else {
      DB.tracking[eff.id].videoProgress[videoId].watched = true;
    }
    saveDB();
  }
}

function downloadItem(stageId, id) {
  const found = findItem(stageId, id);
  const item = found ? found.item : null;
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
    if (item.type === 'pdf') {
      viewPDF(item.fileUrl, item.title);
    } else {
      window.open(item.fileUrl, '_blank');
    }
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

function viewPDF(url) {
  window.open(url, '_blank');
}

async function deleteItem(stageId, id) {
  const found = findItem(stageId, id);
  if (!found) return;
  const item = found.item;
  if (confirm(`هل أنت متأكد من حذف "${item.title}"؟`)) {
    showToast('جاري حذف الملف...', 'info');
    if (item.cloudinaryPublicId) {
      await deleteFromCloudinary(item.cloudinaryPublicId);
    } else if (item.fileUrl) {
      const extractedId = extractPublicIdFromUrl(item.fileUrl);
      if (extractedId) await deleteFromCloudinary(extractedId);
    }
    removeItem(stageId, id);
    saveDB();
    renderContent();
    showToast('تم الحذف بنجاح');
  }
}

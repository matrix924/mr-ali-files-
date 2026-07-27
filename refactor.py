import re

with open('c:/Users/mohamed/Desktop/المنصه/app.js', 'r', encoding='utf-8') as f:
    js = f.read()

# 1. Add Firebase imports and initialization
firebase_init = """
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { getStorage, ref, uploadString, getDownloadURL, uploadBytes } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyB0aU5Yc_3z4ue50_q8VScsOxJWe8ysEgc",
    authDomain: "mr-ali-3cd16.firebaseapp.com",
    projectId: "mr-ali-3cd16",
    storageBucket: "mr-ali-3cd16.firebasestorage.app",
    messagingSenderId: "555917613912",
    appId: "1:555917613912:web:685b7cff219463a8f1232d",
    measurementId: "G-CX0B8HGRM4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
"""

# Replace DB initialization
db_init = """
    const DB = {
      teachers: [],
      students: [],
      parents: [],
      content: {"prep1":[],"prep2":[],"prep3":[],"sec1":[],"sec2":[],"sec3":[]},
      exams: {"prep1":[],"prep2":[],"prep3":[],"sec1":[],"sec2":[],"sec3":[]},
      tracking: {}
    };

    window.saveDB = async function() {
      try {
        await setDoc(doc(db, 'platform', 'users'), { teachers: DB.teachers, students: DB.students, parents: DB.parents });
        await setDoc(doc(db, 'platform', 'content'), DB.content);
        await setDoc(doc(db, 'platform', 'exams'), DB.exams);
        await setDoc(doc(db, 'platform', 'tracking'), DB.tracking);
      } catch (e) {
        console.error('Error saving DB:', e);
        showToast('خطأ في حفظ البيانات: ' + e.message, 'error');
      }
    };
"""

js = re.sub(r'const DB = \{.*?\};.*?function saveDB\(\) \{.*?\n    \}', db_init, js, flags=re.DOTALL)
js = firebase_init + js

# Replace savePDF
save_pdf = """
    async function savePDF() {
      const s = document.getElementById('pStage').value;
      const t = document.getElementById('pTitle').value.trim();
      const d = document.getElementById('pDesc').value.trim();

      if (!validateField(t, 'العنوان', 3)) return;
      if (!window._pdf) { showToast('اختر ملف PDF', 'error'); return; }

      try {
        showToast('جاري الرفع...', 'info');
        const fileId = 'pdf_' + Date.now();
        const fileRef = ref(storage, 'content/' + fileId + '_' + window._pdf.name);
        await uploadBytes(fileRef, window._pdf);
        const downloadUrl = await getDownloadURL(fileRef);

        DB.content[s].push({
          id: fileId,
          title: t,
          description: d,
          type: 'pdf',
          fileName: window._pdf.name,
          fileSize: window._pdf.size,
          fileUrl: downloadUrl,
          date: new Date().toISOString()
        });
        saveDB();
        closeModal();
        renderContent();
        showToast('تم رفع الملف بنجاح!');
      } catch (e) {
        showToast('خطأ في رفع الملف', 'error');
      }
    }
"""
js = re.sub(r'async function savePDF\(\) \{.*?\n    \}', save_pdf, js, flags=re.DOTALL)

# Replace saveFile
save_file = """
    async function saveFile() {
      const s = document.getElementById('fStage').value;
      const t = document.getElementById('fTitle').value.trim();
      const d = document.getElementById('fDesc').value.trim();

      if (!validateField(t, 'العنوان', 3)) return;
      if (!window._file) { showToast('اختر ملف', 'error'); return; }

      try {
        showToast('جاري الرفع...', 'info');
        const fileId = 'file_' + Date.now();
        const fileRef = ref(storage, 'content/' + fileId + '_' + window._file.name);
        await uploadBytes(fileRef, window._file);
        const downloadUrl = await getDownloadURL(fileRef);

        DB.content[s].push({
          id: fileId,
          title: t,
          description: d,
          type: 'file',
          fileName: window._file.name,
          fileSize: window._file.size,
          fileUrl: downloadUrl,
          date: new Date().toISOString()
        });
        saveDB();
        closeModal();
        renderContent();
        showToast('تم رفع الملف بنجاح!');
      } catch (e) {
        showToast('خطأ في رفع الملف', 'error');
      }
    }
"""
js = re.sub(r'async function saveFile\(\) \{.*?\n    \}', save_file, js, flags=re.DOTALL)

# Replace downloadItem to use URL if fileData is absent
download_item = """
    function downloadItem(stageId, id) {
      const item = (DB.content[stageId] || []).find(c => c.id === id);
      if (item?.fileUrl) {
          window.open(item.fileUrl, '_blank');
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
"""
js = re.sub(r'function downloadItem\(stageId, id\) \{.*?\n    \}', download_item, js, flags=re.DOTALL)

# Update DOMContentLoaded to load from Firestore
init_code = """
    document.addEventListener('DOMContentLoaded', async () => {
      // Show loading overlay
      const loader = document.createElement('div');
      loader.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;display:flex;justify-content:center;align-items:center;color:var(--gold);font-size:2rem;flex-direction:column;';
      loader.innerHTML = '<div class="spinner"></div><div style="margin-top:20px;">جاري تحميل البيانات...</div>';
      document.body.appendChild(loader);

      try {
        const usersDoc = await getDoc(doc(db, 'platform', 'users'));
        if(usersDoc.exists()) {
            const d = usersDoc.data();
            DB.teachers = d.teachers || [];
            DB.students = d.students || [];
            DB.parents = d.parents || [];
        }
        const contentDoc = await getDoc(doc(db, 'platform', 'content'));
        if(contentDoc.exists()) DB.content = contentDoc.data();
        const examsDoc = await getDoc(doc(db, 'platform', 'exams'));
        if(examsDoc.exists()) DB.exams = examsDoc.data();
        const trackingDoc = await getDoc(doc(db, 'platform', 'tracking'));
        if(trackingDoc.exists()) DB.tracking = trackingDoc.data();
      } catch(e) {
          console.error("Error loading DB", e);
      }

      document.body.removeChild(loader);

      initDefaultTeacher();
"""
js = re.sub(r"document\.addEventListener\('DOMContentLoaded', \(\) => \{\n      initDefaultTeacher\(\);", init_code, js)

with open('c:/Users/mohamed/Desktop/المنصه/app.js', 'w', encoding='utf-8') as f:
    f.write(js)

print("Refactored app.js")

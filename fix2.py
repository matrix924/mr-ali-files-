with open('c:/Users/mohamed/Desktop/المنصه/app.js', 'r', encoding='utf-8') as f:
    js = f.read()

new_init = """    (async () => {
      // Attach event listeners first so the UI is responsive even if DB hangs
      document.getElementById('loginSubmitBtn').addEventListener('click', e => {
        e.preventDefault();
        login();
      });

      document.getElementById('logoutButton').addEventListener('click', logout);

      document.addEventListener('keypress', e => {
        if (e.key === 'Enter' && document.getElementById('authPage').style.display !== 'none') {
          e.preventDefault();
          login();
        }
      });

      document.getElementById('generalModal').addEventListener('click', function(e) {
        if (e.target === this) closeModal();
      });

      document.getElementById('examModal').addEventListener('click', function(e) {
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
        if (e.key === 'Escape') {
          closeModal();
        }
      });

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
          setTimeout(() => showToast('تحذير: لا يمكن الوصول لقاعدة البيانات. قد تكون الصلاحيات مغلقة في Firebase.', 'error'), 2000);
      }

      document.body.removeChild(loader);
      initDefaultTeacher();
    })();"""

start_idx = js.find('    (async () => {')
end_idx = js.find('    })();', start_idx) + 9

js = js[:start_idx] + new_init + js[end_idx:]

with open('c:/Users/mohamed/Desktop/المنصه/app.js', 'w', encoding='utf-8') as f:
    f.write(js)

print('Patched app.js with better initialization')

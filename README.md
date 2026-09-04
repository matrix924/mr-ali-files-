# منصة العبقري في الرياضيات

منصة تعليمية متكاملة لإدارة المحتوى والامتحانات والطلاب.

## الميزات

- إدارة المحتوى التعليمي (فيديوهات يوتيوب، PDF، ملفات)
- نظام اامتحانات تفاعلي مع مؤقت
- متابعة تقدم الطلاب
- حسابات لأولياء الأمور
- نسخ احتياطي واستعادة البيانات
- تصميم متجاوب يعمل على جميع الأجهزة

## التشغيل

1. افتح ملف `index.html` في المتصفح
2. atau deploy Google Apps Script backend (الملف `Code.gs`)

## الإعداد

### الخطوة 1: إعداد Google Apps Script

1. افتح [Google Apps Script](https://script.google.com)
2. أنشئ مشروع جديد
3. انسخ محتوى `Code.gs` في المحرر
4. عيّن `SPREADSHEET_ID` بمعرف Google Sheet الخاص بك
5._Deploy_ كـ Web App (صادر للجميع)

### الخطوة 2: إعداد Frontend

1. عدّل `js/config.js`:
   - عيّن `APPS_SCRIPT_URL` برابط Apps Script الذي أنشأته
   - عيّن `SECURITY_CONFIG.salt` بمفتاح salt آمن

### الخطوة 3: رفع على GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git
git push -u origin main
```

## الملفات

| الملف | الوصف |
|-------|-------|
| `index.html` | الصفحة الرئيسية |
| `css/` | ملفات التنسيق |
| `js/` | ملفات JavaScript |
| `Code.gs` | Google Apps Script backend |

## أمن

- كلمات المرور مُعرفة بـ SHA-256
- نظام حماية من محاولات الدخول
- جلسات تنتهي بعد ساعة (sessionStorage فقط)
- لا توجد بيانات محفوظة في localStorage
- جميع البيانات تُحفظ في Google Sheets
- الملفات (PDFs, صور) تُرفع على Google Drive

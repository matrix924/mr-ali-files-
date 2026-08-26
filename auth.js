// ============ Authentication ============
async function initDefaultTeacher() {
  if (!DB.teachers.length) {
    console.log('No teachers found, creating default...');
    const hashedPass = await Security.hashPassword('Ali@33');
    DB.teachers.push({
      id: 't1',
      type: 'teacher',
      username: 'Ali@33',
      password: hashedPass,
      name: 'أستاذ علي'
    });
    console.log('Default teacher created, saving...');
    await saveDBSync();
    console.log('Default teacher saved');
  }
}

async function login() {
  const role = document.getElementById('loginRole').value;
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value.trim();

  document.getElementById('usernameError').style.display = 'none';
  document.getElementById('passwordError').style.display = 'none';
  document.getElementById('loginError').style.display = 'none';
  document.getElementById('loginUsername').classList.remove('error');
  document.getElementById('loginPassword').classList.remove('error');

  let hasError = false;

  if (!username) {
    document.getElementById('usernameError').textContent = 'يجب إدخال اسم المستخدم';
    document.getElementById('usernameError').style.display = 'block';
    document.getElementById('loginUsername').classList.add('error');
    hasError = true;
  }

  if (!password) {
    document.getElementById('passwordError').textContent = 'يجب إدخال كلمة المرور';
    document.getElementById('passwordError').style.display = 'block';
    document.getElementById('loginPassword').classList.add('error');
    hasError = true;
  }

  if (hasError) return;

  const loginBtn = document.getElementById('loginSubmitBtn');
  loginBtn.disabled = true;
  loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الدخول...';

  const hashedPassword = await Security.hashPassword(password);

  const matchPassword = (stored, input) => {
    if (!stored) return false;
    return stored === input || stored === hashedPassword;
  };

  let source = [];
  if (role === 'teacher') source = DB.teachers;
  else if (role === 'student') source = DB.students;
  else source = DB.parents;

  console.log('Login attempt - Role:', role, 'Username:', username, 'Source length:', source.length);

  const user = source.find(u => u.username === username && matchPassword(u.password, password));

  loginBtn.disabled = false;
  loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> تسجيل الدخول';

  if (user) {
    if (user.password === password) {
      user.password = hashedPassword;
      saveDB();
    }
    currentUser = { ...user, role };
    document.getElementById('userAvatar').textContent = user.name.charAt(0);
    document.getElementById('userName').textContent = user.name;
    document.getElementById('authPage').style.display = 'none';
    document.getElementById('dashboardPage').style.display = 'block';
    document.getElementById('navbar').style.display = 'flex';
    buildSidebar();
    navigate('overview');
    showToast(`مرحباً ${user.name}!`);
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
  } else {
    let msg = 'بيانات الدخول غير صحيحة';
    if (source.length === 0 && role === 'teacher') {
      msg = 'لا يوجد معلمين مسجلين - تحقق من الاتصال بالخادم';
    }
    document.getElementById('loginError').textContent = msg;
    document.getElementById('loginError').style.display = 'block';
  }
}

function logout() {
  if (examState.timerInterval) clearInterval(examState.timerInterval);
  currentUser = null;
  examState = { currentExam: null, answers: {}, timeRemaining: 0, timerInterval: null, currentQuestion: 0 };
  document.getElementById('authPage').style.display = 'flex';
  document.getElementById('dashboardPage').style.display = 'none';
  document.getElementById('navbar').style.display = 'none';
  document.getElementById('examModal').classList.remove('show');
}

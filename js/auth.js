// ============ Authentication ============
async function initDefaultTeacher() {
  console.log('[Auth] initDefaultTeacher - Teachers count:', DB.teachers.length);
  if (!DB.teachers.length) {
    console.log('[Auth] No teachers found, creating default...');
    const hashedPass = await Security.hashPassword('Ali@33');
    const defaultTeacher = {
      id: Security.generateId('t'),
      type: 'teacher',
      username: 'Ali@33',
      password: hashedPass,
      name: 'أستاذ علي'
    };
    DB.teachers.push(defaultTeacher);
    console.log('[Auth] Default teacher created:', defaultTeacher.username);
    console.log('[Auth] Hashed password:', hashedPass);

    saveDB('users');

    console.log('[Auth] DB.teachers now:', DB.teachers.length);
  } else {
    console.log('[Auth] Teachers already exist:', DB.teachers.length);
  }
}

async function login() {
  const role = document.getElementById('loginRole').value;
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value.trim();

  // Clear previous errors
  document.getElementById('usernameError').style.display = 'none';
  document.getElementById('passwordError').style.display = 'none';
  document.getElementById('loginError').style.display = 'none';
  document.getElementById('loginUsername').classList.remove('error');
  document.getElementById('loginPassword').classList.remove('error');

  // Validation
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

  // Rate limiting check
  const rateLimitKey = `login_${role}_${username}`;
  if (!RateLimiter.canAttempt(rateLimitKey)) {
    const remaining = Math.ceil(RateLimiter.getRemainingTime(rateLimitKey) / 60000);
    document.getElementById('loginError').textContent = `تم تجاوز الحد الأقصى للمحاولات. حاول بعد ${remaining} دقيقة`;
    document.getElementById('loginError').style.display = 'block';
    return;
  }

  const loginBtn = document.getElementById('loginSubmitBtn');
  loginBtn.disabled = true;
  loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الدخول...';

  try {
    const hashedPassword = await Security.hashPassword(password);
    console.log('[Login] Input password:', password);
    console.log('[Login] Hashed input:', hashedPassword);
    console.log('[Login] DB.teachers count:', DB.teachers.length);

    const matchPassword = (stored, input) => {
      if (!stored) return false;
      const matches = stored === input || stored === hashedPassword;
      return matches;
    };

    let source = [];
    if (role === 'teacher') source = DB.teachers;
    else if (role === 'student') source = DB.students;
    else source = DB.parents;

    console.log('[Login] Role:', role, 'Username:', username, 'Source length:', source.length);
    if (source.length > 0) {
      console.log('[Login] First user stored hash:', source[0].password);
    }

    const user = source.find(u => u.username === username && matchPassword(u.password, password));

    if (user) {
      RateLimiter.reset(rateLimitKey);

      if (user.password === password) {
        user.password = hashedPassword;
        saveDB('users');
      }

      currentUser = { ...user, role };
      SessionManager.save(currentUser, role);

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
      RateLimiter.recordAttempt(rateLimitKey);

      let msg = 'بيانات الدخول غير صحيحة';
      if (source.length === 0 && role === 'teacher') {
        msg = 'لا يوجد معلمين مسجلين - تحقق من الاتصال بالخادم';
      }

      const attemptsLeft = SECURITY_CONFIG.maxLoginAttempts - (RateLimiter.attempts[rateLimitKey]?.count || 0);
      if (attemptsLeft <= 2 && attemptsLeft > 0) {
        msg += ` (متبقي ${attemptsLeft} محاولات)`;
      }

      document.getElementById('loginError').textContent = msg;
      document.getElementById('loginError').style.display = 'block';
    }
  } catch (error) {
    console.error('[Login] Error:', error);
    ErrorHandler.handle(error, 'Login');
    document.getElementById('loginError').textContent = 'حدث خطأ أثناء تسجيل الدخول: ' + error.message;
    document.getElementById('loginError').style.display = 'block';
  } finally {
    loginBtn.disabled = false;
    loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> تسجيل الدخول';
  }
}

function logout() {
  if (examState.timerInterval) clearInterval(examState.timerInterval);
  currentUser = null;
  examState = { currentExam: null, answers: {}, timeRemaining: 0, timerInterval: null, currentQuestion: 0 };
  SessionManager.clear();
  document.getElementById('authPage').style.display = 'flex';
  document.getElementById('dashboardPage').style.display = 'none';
  document.getElementById('navbar').style.display = 'none';
  document.getElementById('examModal').classList.remove('show');
}

function checkSession() {
  const session = SessionManager.load();
  if (session && session.user && session.user.username) {
    currentUser = session.user;
    document.getElementById('userAvatar').textContent = currentUser.name.charAt(0);
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('authPage').style.display = 'none';
    document.getElementById('dashboardPage').style.display = 'block';
    document.getElementById('navbar').style.display = 'flex';
    buildSidebar();
    navigate('overview');
    return true;
  }
  return false;
}

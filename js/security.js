// ============ Security Helpers ============
const Security = {
  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  async hashPassword(password) {
    const salt = SECURITY_CONFIG.salt;
    const data = salt + password;
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  generateId(prefix = '') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
  },

  generatePassword(length = 12) {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';
    const symbols = '!@#$%^&*';
    const all = upper + lower + digits + symbols;

    let password = '';
    // Ensure at least one of each type
    password += upper[Math.floor(Math.random() * upper.length)];
    password += lower[Math.floor(Math.random() * lower.length)];
    password += digits[Math.floor(Math.random() * digits.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];

    for (let i = password.length; i < length; i++) {
      password += all[Math.floor(Math.random() * all.length)];
    }

    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  },

  generateUsername(name, role) {
    const arabicToEnglish = {
      'أ': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'h',
      'خ': 'kh', 'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z', 'س': 's',
      'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a',
      'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm',
      'ن': 'n', 'ه': 'h', 'و': 'w', 'ي': 'y', 'ة': 'h', 'ى': 'a',
      'ئ': 'a', 'آ': 'a', 'إ': 'i', 'أ': 'a', 'ؤ': 'a', 'لا': 'la'
    };

    let english = '';
    for (const char of name) {
      english += arabicToEnglish[char] || char;
    }
    english = english.replace(/[^a-zA-Z]/g, '').substring(0, 8) || 'User';

    const prefix = role === 'student' ? 'STU' : 'PRT';
    const suffix = Date.now().toString(36).slice(-4) + Math.floor(Math.random() * 100);
    return `${prefix}_${english}_${suffix}`.toUpperCase();
  }
};

// ============ Rate Limiter ============
const RateLimiter = {
  attempts: {},

  canAttempt(key) {
    const now = Date.now();
    const record = this.attempts[key];

    if (!record) return true;

    if (now - record.firstAttempt > SECURITY_CONFIG.lockoutDuration) {
      delete this.attempts[key];
      return true;
    }

    if (record.count >= SECURITY_CONFIG.maxLoginAttempts) {
      return false;
    }

    return true;
  },

  recordAttempt(key) {
    const now = Date.now();
    if (!this.attempts[key] || now - this.attempts[key].firstAttempt > SECURITY_CONFIG.lockoutDuration) {
      this.attempts[key] = { count: 1, firstAttempt: now };
    } else {
      this.attempts[key].count++;
    }
  },

  reset(key) {
    delete this.attempts[key];
  },

  getRemainingTime(key) {
    const record = this.attempts[key];
    if (!record) return 0;
    const elapsed = Date.now() - record.firstAttempt;
    return Math.max(0, SECURITY_CONFIG.lockoutDuration - elapsed);
  }
};

// ============ Session Manager ============
const SessionManager = {
  save(user, role) {
    const session = {
      user,
      role,
      timestamp: Date.now(),
      expires: Date.now() + SECURITY_CONFIG.sessionTimeout
    };
    sessionStorage.setItem('mathPlatformSession', JSON.stringify(session));
  },

  load() {
    try {
      const raw = sessionStorage.getItem('mathPlatformSession');
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (Date.now() > session.expires) {
        this.clear();
        return null;
      }
      return session;
    } catch {
      return null;
    }
  },

  clear() {
    sessionStorage.removeItem('mathPlatformSession');
  },

  isValid() {
    const session = this.load();
    return session !== null;
  }
};

// ============ Error Boundary ============
const ErrorHandler = {
  handlers: [],

  register(handler) {
    this.handlers.push(handler);
  },

  handle(error, context = '') {
    console.error(`Error in ${context}:`, error);

    // User-friendly message
    const message = this.getUserMessage(error);

    // Notify all registered handlers
    this.handlers.forEach(h => h(error, context, message));

    // Log to server (optional)
    this.logToServer(error, context);

    return message;
  },

  getUserMessage(error) {
    if (error.message?.includes('network') || error.message?.includes('fetch')) {
      return 'خطأ في الاتصال بالخادم. تحقق من اتصالك بالإنترنت.';
    }
    if (error.message?.includes('timeout')) {
      return 'انتهت مهلة الاتصال. حاول مرة أخرى.';
    }
    if (error.message?.includes('permission') || error.message?.includes('auth')) {
      return 'ليس لديك صلاحية للقيام بهذا الإجراء.';
    }
    return 'حدث خطأ غير متوقع. حاول مرة أخرى.';
  },

  async logToServer(error, context) {
    try {
      // Optional: send to logging endpoint
    } catch {
      // Silent fail for logging
    }
  }
};

// Register global error handler
window.onerror = function(msg, url, line, col, error) {
  ErrorHandler.handle(error || new Error(msg), 'Global');
  return false;
};

window.addEventListener('unhandledrejection', function(event) {
  ErrorHandler.handle(event.reason, 'Unhandled Promise');
});

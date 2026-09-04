// ============ Google Apps Script API Client ============
const API = {
  baseUrl: '',

  init(url) {
    this.baseUrl = url;
  },

  async _get(params) {
    const paramStr = encodeURIComponent(JSON.stringify(params));
    const url = `${this.baseUrl}?p=${paramStr}`;
    const response = await fetch(url, { method: 'GET', redirect: 'follow' });
    const text = await response.text();
    try { return JSON.parse(text); } catch (e) { console.error('Parse error:', text); return { error: 'Invalid response' }; }
  },

  async _post(bodyObj) {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      body: JSON.stringify(bodyObj),
      redirect: 'follow'
    });
    const text = await response.text();
    try { return JSON.parse(text); } catch (e) {
      console.error('POST parse error, raw:', text.substring(0, 200));
      return { error: 'POST response not JSON' };
    }
  },

  async testConnection() {
    try {
      const data = await this._get({ action: 'getAllData' });
      if (data && data.error) return { ok: false, error: data.error };
      if (data && (data.teachers !== undefined || data.students !== undefined)) return { ok: true, data };
      return { ok: false, error: 'استجابة غير متوقعة من الخادم' };
    } catch (e) {
      return { ok: false, error: e.message || 'فشل الاتصال بالخادم' };
    }
  },

  async getAllData() {
    return this._get({ action: 'getAllData' });
  },

  async saveUsers(teachers, students, parents) {
    return this._post({ action: 'saveUsers', teachers, students, parents });
  },

  async saveContent(content) {
    return this._post({ action: 'saveContent', content });
  },

  async saveExams(exams) {
    return this._post({ action: 'saveExams', exams });
  },

  async saveTracking(tracking) {
    return this._post({ action: 'saveTracking', tracking });
  },

  async uploadFile(base64Data, fileName, stageId) {
    return this._post({ action: 'uploadFile', base64Data, fileName, stageId });
  },

  async deleteFile(fileId) {
    return this._post({ action: 'deleteFile', fileId });
  }
};

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyCauAoMLbNCLuyh7_acwVuhVsucP7glKvI",
  authDomain: "iainfo-5ef0b.firebaseapp.com",
  projectId: "iainfo-5ef0b",
  storageBucket: "iainfo-5ef0b.firebasestorage.app",
  messagingSenderId: "874564043787",
  appId: "1:874564043787:web:5409a6a9953d57f71db30e",
  measurementId: "G-S6WCZ3RGJJ"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// 启用离线缓存
db.enablePersistence().catch(err => {
  if (err.code === 'failed-precondition') {
    console.warn('多标签页冲突，建议只开一个');
  } else if (err.code === 'unimplemented') {
    console.warn('当前浏览器不支持持久化');
  }
});

// 集合名
const RESUMES_COLLECTION = 'resumes';
const JOBS_COLLECTION = 'jobs';
const SETTINGS_COLLECTION = 'settings';

// 语言包
const translations = {
  zh: {
    dashboard: "欢迎使用 ResumeFiller",
    upload_resume: "上传简历",
    save_job: "收藏岗位",
    fill_btn: "一键填充",
    export_pdf: "📄 导出 PDF",
    ai_suggestion: "🤖 AI 优化建议",
    stats_title: "投递统计",
    login: "登录",
    register: "注册新账号",
    email: "邮箱",
    password: "密码",
    settings: "设置",
    language: "语言 Language",
    theme: "主题",
    auto_fill: "自动填充模式",
    copy: "复制到剪贴板",
    alert: "弹窗提示",
    light: "浅色",
    dark: "深色",
    saved: "保存成功！",
    confirm_delete: "确定删除？",
    please_login: "请先登录！",
    upload_pdf: "请上传 PDF 文件",
    extract_failed: "提取失败，请手动输入",
    resume_saved: "简历已保存！",
    job_saved: "岗位已收藏！",
    copied: "已复制到剪贴板！",
    logout: "退出",
    chart_labels: ["已投递", "已回复", "已面试", "已 Offer"]
  },
  en: {
    dashboard: "Welcome to ResumeFiller",
    upload_resume: "Upload Resume",
    save_job: "Save Job",
    fill_btn: "Auto Fill",
    export_pdf: "📄 Export PDF",
    ai_suggestion: "🤖 AI Suggestion",
    stats_title: "Application Stats",
    login: "Login",
    register: "Register",
    email: "Email",
    password: "Password",
    settings: "Settings",
    language: "Language",
    theme: "Theme",
    auto_fill: "Auto Fill Mode",
    copy: "Copy to Clipboard",
    alert: "Show Alert",
    light: "Light",
    dark: "Dark",
    saved: "Saved!",
    confirm_delete: "Delete?",
    please_login: "Please login first!",
    upload_pdf: "Please upload a PDF file",
    extract_failed: "Extraction failed, please enter manually",
    resume_saved: "Resume saved!",
    job_saved: "Job saved!",
    copied: "Copied to clipboard!",
    logout: "Logout",
    chart_labels: ["Applied", "Replied", "Interviewed", "Offer"]
  }
};

let currentLang = 'zh';

function t(key) {
  return translations[currentLang]?.[key] || key;
}

// 页面切换
function loadPage() {
  const urlHash = window.location.hash || '#dashboard';
  document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
  document.querySelectorAll('nav a').forEach(link => link.classList.remove('active'));

  const targetPage = document.querySelector(urlHash);
  if (targetPage) targetPage.classList.add('active');

  const activeLink = document.querySelector(`a[href="${urlHash}"]`);
  if (activeLink) activeLink.classList.add('active');

  // 更新文本
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.getElementById('modal-title')?.setAttribute('data-i18n', 'upload_resume');
  document.getElementById('modal-title')?.textContent = t(document.getElementById('modal-title')?.getAttribute('data-i18n'));
}

window.addEventListener('hashchange', loadPage);

// 初始化语言和界面
document.addEventListener('DOMContentLoaded', () => {
  loadPage();
  setupAuthListener();
  loadSettings();
  renderStatsChart();
});

// 模态框控制
function showModal(type) {
  const modal = document.getElementById('modal');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');
  const submitBtn = document.getElementById('modal-submit');

  modal.style.display = 'flex';
  title.textContent = type === 'upload-resume' ? t('upload_resume') : t('save_job');

  if (type === 'upload-resume') {
    body.innerHTML = `
      <p>${t('upload_pdf')}</p>
      <input type="file" id="resumeFile" accept=".pdf,.doc,.docx" />
      <p style="margin-top: 1rem; font-size: 0.9rem; color: #666;">${t('extract_failed')}</p>
      <textarea id="resumeText" placeholder="${t('extract_failed')}"></textarea>
      <button class="btn-secondary" style="margin-top: 1rem;" onclick="exportResumeAsPDF('temp')">${t('export_pdf')}</button>
      <button class="btn-secondary" style="margin-top: 1rem;" onclick="showAISuggestionDialog()">${t('ai_suggestion')}</button>
    `;
    document.getElementById('resumeFile').addEventListener('change', extractText);
    submitBtn.onclick = saveResume;
  } else if (type === 'new-job') {
    body.innerHTML = `
      <div class="form-group">
        <label>${t('save_job')}</label>
        <input type="text" id="jobTitle" placeholder="例如：高级前端工程师" />
      </div>
      <div class="form-group">
        <label>公司名称</label>
        <input type="text" id="companyName" placeholder="例如：腾讯" />
      </div>
      <div class="form-group">
        <label>工作地点</label>
        <input type="text" id="location" placeholder="北京/上海/远程" />
      </div>
      <div class="form-group">
        <label>薪资范围</label>
        <input type="text" id="salary" placeholder="例如：20K-35K" />
      </div>
      <div class="form-group">
        <label>岗位要求（简要）</label>
        <textarea id="jobRequirements" placeholder="熟练掌握React/Vue，有3年经验..." rows="4"></textarea>
      </div>
    `;
    submitBtn.onclick = saveJob;
  }

  submitBtn.textContent = type === 'upload-resume' ? '保存简历' : '收藏岗位';
}

function closeModal() {
  document.getElementById('modal').style.display = 'none';
}

// 提取 PDF 文本
async function extractText(e) {
  const file = e.target.files[0];
  if (!file || !file.name.endsWith('.pdf')) {
    alert(t('upload_pdf'));
    return;
 

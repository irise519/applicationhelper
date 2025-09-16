// ✅ 正确方式：使用全局 firebase 对象（与 <script> 标签兼容）
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

// ✅ 使用全局 firebase 对象初始化（不是 import）
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
  }

  const reader = new FileReader();
  reader.onload = async (event) => {
    const typedArray = new Uint8Array(event.target.result);
    try {
      const pdf = await pdfjsLib.getDocument({ typedArray }).promise;
      let fullText = '';

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();
        const texts = content.items.map(item => item.str).join(' ');
        fullText += texts + '\n';
      }

      const extracted = extractResumeInfo(fullText);

      document.getElementById('resumeText').value = `
姓名：${extracted.name || '__________'}
电话：${extracted.phone || '__________'}
邮箱：${extracted.email || '__________'}
教育：${extracted.education || '__________'}
工作经验：${extracted.experience || '__________'}
其他：${fullText.substring(0, 300)}${fullText.length > 300 ? '...' : ''}
      `.trim();
    } catch (error) {
      alert(t('extract_failed'));
    }
  };

  reader.readAsArrayBuffer(file);
}

// 正则提取关键字段
function extractResumeInfo(text) {
  const nameMatch = text.match(/(?:姓名|Name)[:：\s]*(.+?)(?:\n|$)/i);
  const phoneMatch = text.match(/(?:电话|手机|Phone|Tel)[:：\s]*([\d\-+\s]{7,})/i);
  const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  const eduMatch = text.match(/(?:教育|学历|学校|University|College|Degree)[:：\s]*(.+?)(?:\n|$)/i);
  const expMatch = text.match(/(?:工作|经验|Employment|Work|Career)[:：\s]*([\s\S]+?)(?=\n\s*\n|\Z)/i);

  return {
    name: nameMatch ? nameMatch[1].trim() : '',
    phone: phoneMatch ? phoneMatch[1].trim() : '',
    email: emailMatch ? emailMatch[1].trim() : '',
    education: eduMatch ? eduMatch[1].trim() : '',
    experience: expMatch ? expMatch[1].trim() : ''
  };
}

// 保存简历到 Firestore
async function saveResume() {
  const text = document.getElementById('resumeText').value.trim();
  if (!text) {
    alert('请填写简历内容');
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    alert(t('please_login'));
    return;
  }

  await db.collection(RESUMES_COLLECTION).add({
    userId: user.uid,
    name: `简历_${new Date().toLocaleDateString()}`,
    content: text,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  closeModal();
  loadResumes();
  alert(t('resume_saved'));
}

// 加载简历
async function loadResumes() {
  const user = auth.currentUser;
  if (!user) {
    document.getElementById('resume-list').innerHTML = `<p>${t('please_login')}</p>`;
    document.getElementById('resume-count').textContent = '0';
    return;
  }

  const snapshot = await db.collection(RESUMES_COLLECTION)
    .where('userId', '==', user.uid)
    .orderBy('createdAt', 'desc')
    .get();

  const list = document.getElementById('resume-list');
  list.innerHTML = '';

  snapshot.forEach(doc => {
    const r = doc.data();
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <h3>${r.name}</h3>
      <p>${r.content.substring(0, 100)}${r.content.length > 100 ? '...' : ''}</p>
      <button class="fill-btn" onclick="fillResume('${doc.id}')">${t('fill_btn')}</button>
      <button class="fill-btn" onclick="exportResumeAsPDF('${doc.id}')">${t('export_pdf')}</button>
      <button class="delete-btn" onclick="deleteResume('${doc.id}')">×</button>
    `;
    list.appendChild(card);
  });

  document.getElementById('resume-count').textContent = snapshot.size;
  renderStatsChart();
}

// 删除简历
async function deleteResume(id) {
  if (!confirm(t('confirm_delete'))) return;
  const user = auth.currentUser;
  if (!user) return;

  await db.collection(RESUMES_COLLECTION).doc(id).delete();
  loadResumes();
}

// 填充简历
function fillResume(id) {
  const mode = getSetting('autoFillMode', 'copy');
  const user = auth.currentUser;
  if (!user) return;

  db.collection(RESUMES_COLLECTION).doc(id).get().then(doc => {
    if (!doc.exists) return;
    const content = doc.data().content;

    if (mode === 'copy') {
      navigator.clipboard.writeText(content).then(() => {
        alert(t('copied'));
      });
    } else {
      alert('简历内容：\n\n' + content);
    }
  });
}

// 导出 PDF
function exportResumeAsPDF(resumeId) {
  const doc = resumeId === 'temp' 
    ? { data: { content: document.getElementById('resumeText')?.value || '' } } 
    : document.getElementById('resume-list').querySelector(`[onclick*="${resumeId}"]`)?.closest('.item-card');

  let content = '';
  if (resumeId === 'temp') {
    content = document.getElementById('resumeText')?.value || '';
  } else {
    db.collection(RESUMES_COLLECTION).doc(resumeId).get().then(docSnap => {
      if (docSnap.exists) {
        content = docSnap.data().content;
        generatePDF(content);
      }
    });
    return;
  }

  generatePDF(content);
}

function generatePDF(content) {
  const { jsPDF } = window.jspdf;
  const docPDF = new jsPDF();

  docPDF.setFont('helvetica');
  docPDF.setFontSize(12);
  docPDF.text(content.split('\n'), 15, 20);
  docPDF.save(`简历_${new Date().toISOString().split('T')[0]}.pdf`);
}

// 保存岗位
async function saveJob() {
  const job = {
    title: document.getElementById('jobTitle').value.trim(),
    company: document.getElementById('companyName').value.trim(),
    location: document.getElementById('location').value.trim(),
    salary: document.getElementById('salary').value.trim(),
    requirements: document.getElementById('jobRequirements').value.trim(),
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  if (!job.title || !job.company) {
    alert('岗位名称和公司名称必填');
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    alert(t('please_login'));
    return;
  }

  await db.collection(JOBS_COLLECTION).add({
    userId: user.uid,
    ...job
  });

  closeModal();
  loadJobs();
  alert(t('job_saved'));
}

// 加载岗位
async function loadJobs() {
  const user = auth.currentUser;
  if (!user) {
    document.getElementById('job-list').innerHTML = `<p>${t('please_login')}</p>`;
    document.getElementById('job-count').textContent = '0';
    return;
  }

  const snapshot = await db.collection(JOBS_COLLECTION)
    .where('userId', '==', user.uid)
    .orderBy('createdAt', 'desc')
    .get();

  const list = document.getElementById('job-list');
  list.innerHTML = '';

  snapshot.forEach(doc => {
    const j = doc.data();
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <h3>${j.title}</h3>
      <p><strong>${j.company}</strong> · ${j.location} · ${j.salary || '面议'}</p>
      <p style="font-size: 0.9rem; color: #666;">${j.requirements.substring(0, 80)}${j.requirements.length > 80 ? '...' : ''}</p>
      <button class="fill-btn" onclick="copyJobInfo('${doc.id}')">复制信息</button>
      <button class="delete-btn" onclick="deleteJob('${doc.id}')">×</button>
    `;
    list.appendChild(card);
  });

  document.getElementById('job-count').textContent = snapshot.size;
  renderStatsChart();
}

// 复制岗位信息
function copyJobInfo(id) {
  const user = auth.currentUser;
  if (!user) return;

  db.collection(JOBS_COLLECTION).doc(id).get().then(doc => {
    if (!doc.exists) return;
    const j = doc.data();
    const info = `
岗位：${j.title}
公司：${j.company}
地点：${j.location}
薪资：${j.salary}
要求：${j.requirements}
    `.trim();

    navigator.clipboard.writeText(info).then(() => {
      alert(t('copied'));
    });
  });
}

// 删除岗位
async function deleteJob(id) {
  if (!confirm(t('confirm_delete'))) return;
  const user = auth.currentUser;
  if (!user) return;

  await db.collection(JOBS_COLLECTION).doc(id).delete();
  loadJobs();
}

// 保存设置
async function saveSettings() {
  const settings = {
    autoFillMode: document.getElementById('autoFillMode').value,
    theme: document.getElementById('theme').value,
    language: document.getElementById('language').value
  };

  const user = auth.currentUser;
  if (!user) {
    alert('请先登录以保存设置');
    return;
  }

  await db.collection(SETTINGS_COLLECTION).doc(user.uid).set(settings, { merge: true });
  applySettings(settings);
  alert(t('saved'));
}

// 加载设置
async function loadSettings() {
  const user = auth.currentUser;
  if (!user) return;

  const doc = await db.collection(SETTINGS_COLLECTION).doc(user.uid).get();
  if (doc.exists) {
    const settings = doc.data();
    applySettings(settings);
  }
}

function applySettings(settings) {
  if (settings.theme === 'dark') {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }

  if (settings.language) {
    currentLang = settings.language;
    document.getElementById('language').value = currentLang;
    loadPage(); // 刷新语言
  }

  document.getElementById('autoFillMode').value = settings.autoFillMode || 'copy';
  document.getElementById('theme').value = settings.theme || 'light';
}

function getSetting(key, defaultValue) {
  const user = auth.currentUser;
  if (!user) return defaultValue;

  const saved = localStorage.getItem(`settings_${user.uid}`);
  if (saved) {
    const settings = JSON.parse(saved);
    return settings[key] || defaultValue;
  }
  return defaultValue;
}

// 渲染投递统计图
function renderStatsChart() {
  const ctx = document.getElementById('stats-chart')?.getContext('2d');
  if (!ctx) return;

  const user = auth.currentUser;
  if (!user) {
    if (window.chartInstance) window.chartInstance.destroy();
    return;
  }

  Promise.all([
    db.collection(RESUMES_COLLECTION).where('userId', '==', user.uid).get(),
    db.collection(JOBS_COLLECTION).where('userId', '==', user.uid).get()
  ]).then(([resumes, jobs]) => {
    const applied = resumes.size;
    const replied = Math.floor(Math.random() * (applied + 1)); // 模拟
    const interviewed = Math.floor(Math.random() * (replied + 1));
    const offer = Math.floor(Math.random() * (interviewed + 1));

    if (window.chartInstance) window.chartInstance.destroy();

    window.chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [t('chart_labels')[0], t('chart_labels')[1], t('chart_labels')[2], t('chart_labels')[3]],
        datasets: [{
          label: t('stats_title'),
          data: [applied, replied, interviewed, offer],
          backgroundColor: ['#4a6fa5', '#28a745', '#ffc107', '#dc3545']
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });
  });
}

// AI 智能建议（演示版）
function showAISuggestionDialog() {
  const resumeText = document.getElementById('resumeText')?.value || '';
  const jobTitle = document.getElementById('jobTitle')?.value || '';

  if (!resumeText) {
    alert('请先填写简历内容');
    return;
  }

  const suggestions = [
    "增加‘团队协作’关键词",
    "量化成果：提升效率30%",
    "突出项目经历而非职责",
    "避免空洞形容词，如‘认真负责’",
    "匹配JD中的技能关键词"
  ];

  alert("🤖 AI 优化建议：\n\n" + suggestions.join('\n'));
}

// Firebase 认证监听
function setupAuthListener() {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      document.getElementById('login-link').textContent = `👤 ${user.email.split('@')[0]}`;
      document.getElementById('login-link').href = '#dashboard';
      document.getElementById('logout-btn').style.display = 'flex';
      loadResumes();
      loadJobs();
      loadSettings();
    } else {
      document.getElementById('login-link').textContent = t('login');
      document.getElementById('login-link').href = '#login';
      document.getElementById('logout-btn').style.display = 'none';
      document.getElementById('resume-list').innerHTML = `<p>${t('please_login')}</p>`;
      document.getElementById('job-list').innerHTML = `<p>${t('please_login')}</p>`;
      document.getElementById('resume-count').textContent = '0';
      document.getElementById('job-count').textContent = '0';
      if (window.chartInstance) window.chartInstance.destroy();
    }
  });
}

// 登录
async function login() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  if (!email || !password) {
    alert('请输入邮箱和密码');
    return;
  }

  try {
    await auth.signInWithEmailAndPassword(email, password);
    alert(t('saved'));
    window.location.hash = '#dashboard';
  } catch (error) {
    alert('登录失败：' + error.message);
  }
}

// 注册
async function register() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  if (!email || !password) {
    alert('请输入邮箱和密码');
    return;
  }

  try {
    await auth.createUserWithEmailAndPassword(email, password);
    alert('注册成功，已自动登录！');
    window.location.hash = '#dashboard';
  } catch (error) {
    alert('注册失败：' + error.message);
  }
}

// 退出
async function logout() {
  await auth.signOut();
  alert(t('logout'));
  window.location.hash = '#login';
}

// 注册退出按钮事件
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('logout-btn')?.addEventListener('click', logout);

  // 监听语言变化
  document.getElementById('language')?.addEventListener('change', () => {
    currentLang = document.getElementById('language').value;
    loadPage();
  });
});

// Service Worker 注册（PWA）
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('SW registered: ', registration);
    }).catch(registrationError => {
      console.log('SW registration failed: ', registrationError);
    });
  });
}

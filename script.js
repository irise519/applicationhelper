const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY, // 例如: "AIza..."
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, // 例如: "iainfo-5ef0b.firebaseapp.com"
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, // 例如: "iainfo-5ef0b"
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET, // 例如: "iainfo-5ef0b.firebasestorage.app"
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID, // 例如: "874564043787"
  appId: import.meta.env.VITE_FIREBASE_APP_ID, // 例如: "1:874564043787:web:5409a6a9953d57f71db30e"
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID // 例如: "G-S6WCZ3RGJJ"
};

// 初始化 Firebase
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

// =================================================================
// 全局状态和常量
// =================================================================
const RESUMES_COLLECTION = 'resumes';
const JOBS_COLLECTION = 'jobs';
const SETTINGS_COLLECTION = 'settings';

let currentLang = 'zh';
let userSettings = { // 用于存储从 Firestore 加载的用户设置
  theme: 'light',
  language: 'zh',
  autoFillMode: 'copy'
};
let chartInstance = null; // 用于持有图表实例，方便销毁

// =================================================================
// 国际化 (i18n)
// =================================================================
const translations = {
  zh: {
    dashboard: "欢迎使用 ResumeFiller",
    upload_resume: "上传/编辑简历",
    save_job: "收藏新岗位",
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
    confirm_delete: "确定删除吗？",
    please_login: "请先登录！",
    upload_pdf: "请上传 PDF 文件",
    extract_failed: "自动提取失败，请检查文件或手动输入",
    resume_saved: "简历已保存！",
    job_saved: "岗位已收藏！",
    copied: "已复制到剪贴板！",
    logout: "退出登录",
    chart_labels: ["已投递", "已回复", "已面试", "已 Offer"],
    save_resume_btn: "保存简历",
    save_job_btn: "收藏岗位",
    job_title: "岗位名称",
    job_title_placeholder: "例如：高级前端工程师",
    company_name: "公司名称",
    company_name_placeholder: "例如：谷歌",
    job_location: "工作地点",
    job_location_placeholder: "例如：北京/上海/远程",
    salary_range: "薪资范围",
    salary_range_placeholder: "例如：20K-35K",
    job_requirements: "岗位要求（简要）",
    job_requirements_placeholder: "熟练掌握React/Vue，有3年经验...",
    required_fields: "岗位名称和公司名称为必填项",
    resume_content_required: "请填写简历内容",
    email_password_required: "请输入邮箱和密码",
    login_failed: "登录失败：",
    register_success: "注册成功，已自动登录！",
    register_failed: "注册失败：",
    ai_suggestion_placeholder: "请先在上方文本框中填入简历内容",
    ai_suggestions_title: "🤖 AI 优化建议："
  },
  en: {
    dashboard: "Welcome to ResumeFiller",
    upload_resume: "Upload/Edit Resume",
    save_job: "Save New Job",
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
    confirm_delete: "Are you sure you want to delete?",
    please_login: "Please login first!",
    upload_pdf: "Please upload a PDF file",
    extract_failed: "Extraction failed, please check the file or enter manually",
    resume_saved: "Resume saved!",
    job_saved: "Job saved!",
    copied: "Copied to clipboard!",
    logout: "Logout",
    chart_labels: ["Applied", "Replied", "Interviewed", "Offer"],
    save_resume_btn: "Save Resume",
    save_job_btn: "Save Job",
    job_title: "Job Title",
    job_title_placeholder: "e.g., Senior Frontend Engineer",
    company_name: "Company Name",
    company_name_placeholder: "e.g., Google",
    job_location: "Location",
    job_location_placeholder: "e.g., Beijing/Shanghai/Remote",
    salary_range: "Salary Range",
    salary_range_placeholder: "e.g., 20K-35K",
    job_requirements: "Job Requirements (Brief)",
    job_requirements_placeholder: "Proficient in React/Vue, 3 years of experience...",
    required_fields: "Job title and company name are required",
    resume_content_required: "Please fill in the resume content",
    email_password_required: "Please enter email and password",
    login_failed: "Login failed: ",
    register_success: "Registration successful, logged in automatically!",
    register_failed: "Registration failed: ",
    ai_suggestion_placeholder: "Please fill in the resume content in the text box above first",
    ai_suggestions_title: "🤖 AI Optimization Suggestions:"
  }
};

function t(key) {
  return translations[currentLang]?.[key] || key;
}

// =================================================================
// 核心应用逻辑：页面加载、初始化
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
  // 统一的初始化入口
  setupAuthListener();
  loadPage();

  // 绑定静态事件监听器
  document.getElementById('logout-btn')?.addEventListener('click', logout);
  document.getElementById('language')?.addEventListener('change', (e) => {
    currentLang = e.target.value;
    userSettings.language = currentLang;
    loadPage(); // 重新渲染UI文本
    saveSettings(); // 将语言偏好保存到Firestore
  });
  document.getElementById('theme')?.addEventListener('change', saveSettings);
  document.getElementById('autoFillMode')?.addEventListener('change', saveSettings);
});

window.addEventListener('hashchange', loadPage);

// Service Worker 注册 (PWA)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('SW registered: ', registration);
    }).catch(registrationError => {
      console.log('SW registration failed: ', registrationError);
    });
  });
}

function loadPage() {
  const urlHash = window.location.hash || '#dashboard';
  document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
  document.querySelectorAll('nav a').forEach(link => link.classList.remove('active'));

  const targetPage = document.querySelector(urlHash);
  if (targetPage) targetPage.classList.add('active');

  const activeLink = document.querySelector(`a[href="${urlHash}"]`);
  if (activeLink) activeLink.classList.add('active');

  // 更新所有带 data-i18n 属性的元素的文本
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = t(key);
    } else {
        el.textContent = t(key);
    }
  });

  // 如果在 dashboard 页面，渲染图表
  if (urlHash === '#dashboard') {
      renderStatsChart();
  }
}

// =================================================================
// 模态框控制
// =================================================================
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
    submitBtn.textContent = t('save_resume_btn');
    submitBtn.onclick = saveResume;
  } else if (type === 'new-job') {
    body.innerHTML = `
      <div class="form-group">
        <label>${t('job_title')}</label>
        <input type="text" id="jobTitle" placeholder="${t('job_title_placeholder')}" />
      </div>
      <div class="form-group">
        <label>${t('company_name')}</label>
        <input type="text" id="companyName" placeholder="${t('company_name_placeholder')}" />
      </div>
      <div class="form-group">
        <label>${t('job_location')}</label>
        <input type="text" id="location" placeholder="${t('job_location_placeholder')}" />
      </div>
      <div class="form-group">
        <label>${t('salary_range')}</label>
        <input type="text" id="salary" placeholder="${t('salary_range_placeholder')}" />
      </div>
      <div class="form-group">
        <label>${t('job_requirements')}</label>
        <textarea id="jobRequirements" placeholder="${t('job_requirements_placeholder')}" rows="4"></textarea>
      </div>
    `;
    submitBtn.textContent = t('save_job_btn');
    submitBtn.onclick = saveJob;
  }
}

function closeModal() {
  document.getElementById('modal').style.display = 'none';
}

// =================================================================
// 简历处理 (上传、保存、加载、删除、导出)
// =================================================================
async function extractText(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (!file.name.endsWith('.pdf')) {
    alert(t('upload_pdf'));
    return;
  }
  
  // TODO: 显示加载动画
  const reader = new FileReader();
  reader.onload = async (event) => {
    const typedArray = new Uint8Array(event.target.result);
    try {
      const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
      let fullText = '';

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();
        const texts = content.items.map(item => item.str).join(' ');
        fullText += texts + '\n';
      }

      const extracted = extractResumeInfo(fullText);
      document.getElementById('resumeText').value = `姓名：${extracted.name || '__________'}\n电话：${extracted.phone || '__________'}\n邮箱：${extracted.email || '__________'}\n\n教育背景：\n${extracted.education || '__________'}\n\n工作经验：\n${extracted.experience || '__________'}\n\n---\n原始文本：\n${fullText.substring(0, 500)}${fullText.length > 500 ? '...' : ''}`.trim();

    } catch (error) {
      console.error("PDF parsing error:", error);
      alert(t('extract_failed'));
    } finally {
      // TODO: 隐藏加载动画
    }
  };
  reader.readAsArrayBuffer(file);
}

// 注意：这个正则提取非常基础，仅适用于格式固定的简历。
function extractResumeInfo(text) {
  const nameMatch = text.match(/(?:姓名|Name)[:：\s]*(.+?)(?:\n|$)/i);
  const phoneMatch = text.match(/(?:电话|手机|Phone|Tel)[:：\s]*([\d\-+\s]{7,})/i);
  const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  const eduMatch = text.match(/(?:教育|学历|学校|University|College|Degree)[:：\s]*([\s\S]+?)(?=(?:工作|经验|项目|Employment|Work|Career|$))/i);
  const expMatch = text.match(/(?:工作|经验|项目|Employment|Work|Career)[:：\s]*([\s\S]+?)(?=(?:技能|项目|荣誉|Skills|$))/i);

  return {
    name: nameMatch ? nameMatch[1].trim() : '',
    phone: phoneMatch ? phoneMatch[1].trim() : '',
    email: emailMatch ? emailMatch[1].trim() : '',
    education: eduMatch ? eduMatch[1].trim() : '',
    experience: expMatch ? expMatch[1].trim() : ''
  };
}

async function saveResume() {
  const text = document.getElementById('resumeText').value.trim();
  if (!text) {
    alert(t('resume_content_required'));
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    alert(t('please_login'));
    return;
  }
  
  // TODO: 显示保存中状态
  try {
    await db.collection(RESUMES_COLLECTION).add({
      userId: user.uid,
      name: `简历_${new Date().toLocaleDateString()}`,
      content: text,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    closeModal();
    loadResumes();
    alert(t('resume_saved'));
  } catch (error) {
    console.error("Error saving resume: ", error);
    alert(error.message);
  } finally {
    // TODO: 隐藏保存中状态
  }
}

async function loadResumes() {
  const user = auth.currentUser;
  const list = document.getElementById('resume-list');
  
  if (!user) {
    list.innerHTML = `<p>${t('please_login')}</p>`;
    document.getElementById('resume-count').textContent = '0';
    return;
  }
  
  // TODO: 显示加载动画
  list.innerHTML = ''; // 先清空
  try {
      const snapshot = await db.collection(RESUMES_COLLECTION)
        .where('userId', '==', user.uid)
        .orderBy('createdAt', 'desc')
        .get();

      snapshot.forEach(doc => {
        const r = doc.data();
        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `
          <h3>${r.name}</h3>
          <p>${r.content.substring(0, 100)}${r.content.length > 100 ? '...' : ''}</p>
          <div class="card-actions">
            <button class="fill-btn" onclick="fillResume('${doc.id}')">${t('fill_btn')}</button>
            <button class="fill-btn" onclick="exportResumeAsPDF('${doc.id}')">${t('export_pdf')}</button>
            <button class="delete-btn" onclick="deleteResume('${doc.id}')">×</button>
          </div>
        `;
        list.appendChild(card);
      });
      document.getElementById('resume-count').textContent = snapshot.size;
  } catch(error) {
      console.error("Error loading resumes:", error);
      list.innerHTML = `<p>Error: ${error.message}</p>`;
  } finally {
      // TODO: 隐藏加载动画
      renderStatsChart();
  }
}

async function deleteResume(id) {
  if (!confirm(t('confirm_delete'))) return;

  const user = auth.currentUser;
  if (!user) return;

  try {
    await db.collection(RESUMES_COLLECTION).doc(id).delete();
    loadResumes();
  } catch (error) {
    console.error("Error deleting resume: ", error);
    alert(error.message);
  }
}

async function fillResume(id) {
  const mode = userSettings.autoFillMode || 'copy';
  const user = auth.currentUser;
  if (!user) return;

  try {
    const doc = await db.collection(RESUMES_COLLECTION).doc(id).get();
    if (!doc.exists) return;
    const content = doc.data().content;

    if (mode === 'copy') {
      await navigator.clipboard.writeText(content);
      alert(t('copied'));
    } else {
      alert('简历内容：\n\n' + content);
    }
  } catch (error) {
    console.error("Error filling resume: ", error);
    alert(error.message);
  }
}

async function exportResumeAsPDF(resumeId) {
  let content = '';
  try {
    if (resumeId === 'temp') {
      content = document.getElementById('resumeText')?.value || '';
    } else {
      const docSnap = await db.collection(RESUMES_COLLECTION).doc(resumeId).get();
      if (docSnap.exists) {
        content = docSnap.data().content;
      }
    }
    if (content) {
      generatePDF(content);
    } else {
        alert("没有可以导出的内容。");
    }
  } catch (error) {
      console.error("Error preparing PDF export: ", error);
      alert(error.message);
  }
}

/**
 * 生成 PDF (已修复中文乱码问题)
 *
 * @param {string} content - 要写入 PDF 的文本内容
 * @requires 
 * 1. 在你的项目中引入 jspdf.umd.min.js
 * 2. 【重要】下载一个支持中文的 .ttf 字体文件（例如：思源黑体 SourceHanSansCN-Regular.ttf）。
 * 3. 将字体文件放在你的项目 public/fonts/ 目录下，确保可以访问到。
 * 4. 你需要将字体文件转换为 jsPDF 可识别的 base64 格式，或使用工具/代码在客户端加载。
 * 一个简便的方法是使用 jsPDF 的 `addFileToVFS` 和 `addFont`。
 * 下面的代码假设你已经有一个名为 `SourceHanSans-Normal.ttf` 的字体文件。
 */
async function generatePDF(content) {
    const { jsPDF } = window.jspdf;
    const docPDF = new jsPDF();
    
    // TODO: 你需要提供字体文件。
    // 为了让此功能正常工作，你需要下载一个中文字体（如“思源黑体”），
    // 将其放在你的项目目录中，并通过 fetch 加载。
    try {
        // 示例：从服务器加载字体文件
        // const font = await fetch('/fonts/SourceHanSans-Normal.ttf').then(res => res.arrayBuffer());
        // const fontBase64 = btoa(String.fromCharCode.apply(null, new Uint8Array(font)));

        // docPDF.addFileToVFS('SourceHanSans-Normal.ttf', fontBase64);
        // docPDF.addFont('SourceHanSans-Normal.ttf', 'SourceHanSans', 'normal');
        // docPDF.setFont('SourceHanSans');

        // 临时降级方案：如果字体加载失败，使用默认字体并提示用户
        alert("PDF 导出功能正在使用标准字体，中文可能无法显示。\n请配置中文字体文件以获得完整支持。");
        docPDF.setFont('helvetica'); // Fallback font

        docPDF.setFontSize(12);
        const lines = docPDF.splitTextToSize(content, 180); // 自动换行
        docPDF.text(lines, 15, 20);
        docPDF.save(`简历_${new Date().toISOString().split('T')[0]}.pdf`);

    } catch (error) {
        console.error("加载字体或生成 PDF 失败:", error);
        alert("导出 PDF 失败，请检查控制台获取更多信息。");
    }
}


// =================================================================
// 岗位处理 (保存、加载、删除、复制)
// =================================================================
async function saveJob() {
  const job = {
    title: document.getElementById('jobTitle').value.trim(),
    company: document.getElementById('companyName').value.trim(),
    location: document.getElementById('location').value.trim(),
    salary: document.getElementById('salary').value.trim(),
    requirements: document.getElementById('jobRequirements').value.trim(),
  };

  if (!job.title || !job.company) {
    alert(t('required_fields'));
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    alert(t('please_login'));
    return;
  }
  
  // TODO: 显示保存中
  try {
      await db.collection(JOBS_COLLECTION).add({
        userId: user.uid,
        ...job,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      closeModal();
      loadJobs();
      alert(t('job_saved'));
  } catch (error) {
      console.error("Error saving job:", error);
      alert(error.message);
  } finally {
      // TODO: 隐藏保存中
  }
}

async function loadJobs() {
  const user = auth.currentUser;
  const list = document.getElementById('job-list');

  if (!user) {
    list.innerHTML = `<p>${t('please_login')}</p>`;
    document.getElementById('job-count').textContent = '0';
    return;
  }
  
  // TODO: 显示加载动画
  list.innerHTML = ''; // 先清空
  try {
    const snapshot = await db.collection(JOBS_COLLECTION)
      .where('userId', '==', user.uid)
      .orderBy('createdAt', 'desc')
      .get();
      
    snapshot.forEach(doc => {
      const j = doc.data();
      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML = `
        <h3>${j.title}</h3>
        <p><strong>${j.company}</strong> · ${j.location || 'N/A'} · ${j.salary || '面议'}</p>
        <p class="requirements">${j.requirements.substring(0, 80)}${j.requirements.length > 80 ? '...' : ''}</p>
        <div class="card-actions">
            <button class="fill-btn" onclick="copyJobInfo('${doc.id}')">${t('copy')}</button>
            <button class="delete-btn" onclick="deleteJob('${doc.id}')">×</button>
        </div>
      `;
      list.appendChild(card);
    });
    document.getElementById('job-count').textContent = snapshot.size;
  } catch (error) {
      console.error("Error loading jobs:", error);
      list.innerHTML = `<p>Error: ${error.message}</p>`;
  } finally {
      // TODO: 隐藏加载动画
      renderStatsChart();
  }
}

async function deleteJob(id) {
  if (!confirm(t('confirm_delete'))) return;
  const user = auth.currentUser;
  if (!user) return;
  
  try {
      await db.collection(JOBS_COLLECTION).doc(id).delete();
      loadJobs();
  } catch (error) {
      console.error("Error deleting job:", error);
      alert(error.message);
  }
}

async function copyJobInfo(id) {
  const user = auth.currentUser;
  if (!user) return;
  
  try {
      const doc = await db.collection(JOBS_COLLECTION).doc(id).get();
      if (!doc.exists) return;
      const j = doc.data();
      const info = `岗位：${j.title}\n公司：${j.company}\n地点：${j.location}\n薪资：${j.salary}\n要求：${j.requirements}`.trim();

      await navigator.clipboard.writeText(info);
      alert(t('copied'));
  } catch (error) {
      console.error("Error copying job info:", error);
      alert(error.message);
  }
}

// =================================================================
// 设置处理
// =================================================================
async function saveSettings() {
  const newSettings = {
    autoFillMode: document.getElementById('autoFillMode').value,
    theme: document.getElementById('theme').value,
    language: document.getElementById('language').value
  };

  const user = auth.currentUser;
  if (!user) {
    // 对于未登录用户，只应用设置，不保存
    applySettings(newSettings);
    return;
  }

  try {
    await db.collection(SETTINGS_COLLECTION).doc(user.uid).set(newSettings, { merge: true });
    userSettings = {...userSettings, ...newSettings}; // 更新全局设置状态
    applySettings(userSettings);
    // 不再弹窗提示，因为是即时保存
  } catch (error) {
    console.error("Error saving settings:", error);
    alert(error.message);
  }
}

async function loadSettings() {
  const user = auth.currentUser;
  if (!user) {
    // 如果用户未登录，应用默认设置
    applySettings(userSettings);
    return;
  }

  try {
    const doc = await db.collection(SETTINGS_COLLECTION).doc(user.uid).get();
    if (doc.exists) {
      userSettings = doc.data();
    }
  } catch (error) {
    console.error("Error loading settings:", error);
    // 加载失败时使用默认设置
  } finally {
      applySettings(userSettings);
  }
}

function applySettings(settings) {
  // 应用主题
  if (settings.theme === 'dark') {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
  document.getElementById('theme').value = settings.theme || 'light';

  // 应用语言
  currentLang = settings.language || 'zh';
  document.getElementById('language').value = currentLang;
  loadPage(); // 重新渲染UI

  // 应用填充模式
  document.getElementById('autoFillMode').value = settings.autoFillMode || 'copy';
}

// =================================================================
// 统计图表
// =================================================================
async function renderStatsChart() {
  const ctx = document.getElementById('stats-chart')?.getContext('2d');
  if (!ctx) return;

  const user = auth.currentUser;
  if (!user) {
    if (chartInstance) chartInstance.destroy();
    return;
  }
  
  // TODO: 这里的数据是模拟的。
  // 真实场景下，你需要在 jobs 集合中增加一个 `status` 字段 (例如 'applied', 'replied')
  // 然后在这里进行真实的聚合查询，而不是使用随机数。
  try {
      const jobsSnapshot = await db.collection(JOBS_COLLECTION).where('userId', '==', user.uid).get();
      const applied = jobsSnapshot.size;
      const replied = Math.floor(Math.random() * (applied / 2 + 1)); // 模拟回复数
      const interviewed = Math.floor(Math.random() * (replied + 1)); // 模拟面试数
      const offer = Math.floor(Math.random() * (interviewed / 2 + 1)); // 模拟Offer数

      const chartData = {
          labels: t('chart_labels'),
          datasets: [{
              label: t('stats_title'),
              data: [applied, replied, interviewed, offer],
              backgroundColor: ['#4a6fa5', '#28a745', '#ffc107', '#dc3545'],
              borderRadius: 5,
          }]
      };

      if (chartInstance) {
          chartInstance.data = chartData;
          chartInstance.update();
      } else {
          chartInstance = new Chart(ctx, {
              type: 'bar',
              data: chartData,
              options: {
                  responsive: true,
                  plugins: { legend: { display: false } },
                  scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
              }
          });
      }
  } catch (error) {
      console.error("Error rendering chart:", error);
  }
}

// =================================================================
// AI 建议 (演示)
// =================================================================
function showAISuggestionDialog() {
  const resumeText = document.getElementById('resumeText')?.value || '';
  if (!resumeText) {
    alert(t('ai_suggestion_placeholder'));
    return;
  }

  const suggestions = [
    "增加量化的项目成果，例如：'将页面加载时间优化了30%'，而不是'优化了页面性能'。",
    "根据目标岗位的JD（职位描述），提取关键词（如 React, Webpack, Docker）并融入到你的项目经历中。",
    "使用 STAR 法则（Situation, Task, Action, Result）来描述你的项目经历，使其更具条理和说服力。",
    "避免使用'精通'等主观性强的词汇，除非你确实是该领域的专家。可替换为'熟练使用'或'有...项目经验'。",
    "检查语法和拼写错误，确保简历的专业性。"
  ];

  alert(t('ai_suggestions_title') + "\n\n" + suggestions.join('\n\n'));
}

// =================================================================
// Firebase 认证 (登录、注册、退出、状态监听)
// =================================================================
function setupAuthListener() {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      // 用户已登录
      document.getElementById('login-link').textContent = `👤 ${user.email.split('@')[0]}`;
      document.getElementById('login-link').href = '#dashboard';
      document.getElementById('logout-btn').style.display = 'inline-block';
      
      await loadSettings(); // 登录后首先加载用户设置
      loadResumes();
      loadJobs();
    } else {
      // 用户已退出
      document.body.classList.remove('dark-mode'); // 退出后恢复默认主题
      document.getElementById('login-link').textContent = t('login');
      document.getElementById('login-link').href = '#login';
      document.getElementById('logout-btn').style.display = 'none';
      
      // 清理用户数据界面
      document.getElementById('resume-list').innerHTML = `<p>${t('please_login')}</p>`;
      document.getElementById('job-list').innerHTML = `<p>${t('please_login')}</p>`;
      document.getElementById('resume-count').textContent = '0';
      document.getElementById('job-count').textContent = '0';
      if (chartInstance) chartInstance.destroy();
      chartInstance = null;
    }
    // 无论登录与否都刷新一次页面文本
    loadPage();
  });
}

async function login() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  if (!email || !password) {
    alert(t('email_password_required'));
    return;
  }

  try {
    await auth.signInWithEmailAndPassword(email, password);
    window.location.hash = '#dashboard';
  } catch (error) {
    alert(t('login_failed') + error.message);
  }
}

async function register() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  if (!email || !password) {
    alert(t('email_password_required'));
    return;
  }

  try {
    await auth.createUserWithEmailAndPassword(email, password);
    alert(t('register_success'));
    window.location.hash = '#dashboard';
  } catch (error) {
    alert(t('register_failed') + error.message);
  }
}

async function logout() {
  try {
    await auth.signOut();
    // onAuthStateChanged 会自动处理UI更新
    window.location.hash = '#login';
  } catch (error) {
      console.error("Logout failed:", error);
  }
}

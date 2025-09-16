// 数据存储键名
const RESUMES_KEY = 'resumeFiller_resumes';
const JOBS_KEY = 'resumeFiller_jobs';
const SETTINGS_KEY = 'resumeFiller_settings';
const USER_KEY = 'resumeFiller_user';

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  loadPage();
  loadResumes();
  loadJobs();
  loadSettings();
  checkLogin();
});

// 页面切换
function loadPage() {
  const urlHash = window.location.hash || '#dashboard';
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });
  document.querySelectorAll('nav a').forEach(link => {
    link.classList.remove('active');
  });

  const targetPage = document.querySelector(urlHash);
  if (targetPage) {
    targetPage.classList.add('active');
  }

  const activeLink = document.querySelector(`a[href="${urlHash}"]`);
  if (activeLink) {
    activeLink.classList.add('active');
  }
}

window.addEventListener('hashchange', loadPage);

// 模态框控制
function showModal(type) {
  const modal = document.getElementById('modal');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');
  const submitBtn = document.getElementById('modal-submit');

  modal.style.display = 'flex';
  title.textContent = type === 'upload-resume' ? '上传简历' : '收藏岗位';

  if (type === 'upload-resume') {
    body.innerHTML = `
      <p>请选择你的简历文件（PDF/DOCX）</p>
      <input type="file" id="resumeFile" accept=".pdf,.doc,.docx" />
      <p style="margin-top: 1rem; font-size: 0.9rem; color: #666;">系统会自动提取文本，您可编辑后保存。</p>
      <textarea id="resumeText" placeholder="提取的文本将显示在这里..."></textarea>
    `;
    document.getElementById('resumeFile').addEventListener('change', extractText);
    submitBtn.onclick = saveResume;
  } else if (type === 'new-job') {
    body.innerHTML = `
      <div class="form-group">
        <label>岗位名称</label>
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

// 从文件提取文本
async function extractText(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    const content = event.target.result;
    let text = '';

    // 简单处理 PDF（实际项目可用 pdf.js）
    if (file.name.endsWith('.pdf')) {
      text = await extractPdfText(content);
    } else if (file.name.endsWith('.docx')) {
      text = "⚠️ DOCX 文件需要专业解析库，此处仅演示文本输入。请复制粘贴简历内容。";
    } else {
      text = content.toString();
    }

    document.getElementById('resumeText').value = text;
  };

  if (file.type === 'application/pdf') {
    reader.readAsArrayBuffer(file);
  } else {
    reader.readAsText(file);
  }
}

// 简化版 PDF 文本提取（生产环境建议使用 pdf.js）
async function extractPdfText(buffer) {
  // 这里是简化版本，实际需引入 pdf.js
  return "【PDF内容提取功能需集成 pdf.js 库】\n\n请手动复制粘贴简历内容。\n姓名：__________\n电话：__________\n邮箱：__________\n教育：__________\n工作经验：__________";
}

// 保存简历
function saveResume() {
  const text = document.getElementById('resumeText').value.trim();
  if (!text) {
    alert('请填写简历内容');
    return;
  }

  const resumes = JSON.parse(localStorage.getItem(RESUMES_KEY) || '[]');
  const resume = {
    id: Date.now(),
    name: `简历_${new Date().toLocaleDateString()}`,
    content: text,
    createdAt: new Date().toISOString()
  };
  resumes.push(resume);
  localStorage.setItem(RESUMES_KEY, JSON.stringify(resumes));
  closeModal();
  loadResumes();
}

// 加载简历列表
function loadResumes() {
  const resumes = JSON.parse(localStorage.getItem(RESUMES_KEY) || '[]');
  const list = document.getElementById('resume-list');
  list.innerHTML = '';

  resumes.forEach(r => {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <h3>${r.name}</h3>
      <p>${r.content.substring(0, 100)}${r.content.length > 100 ? '...' : ''}</p>
      <button class="fill-btn" onclick="fillResume('${r.id}')">一键填充</button>
      <button class="delete-btn" onclick="deleteResume(${r.id})">×</button>
    `;
    list.appendChild(card);
  });

  document.getElementById('resume-count').textContent = resumes.length;
}

// 删除简历
function deleteResume(id) {
  if (!confirm('确定删除？')) return;
  let resumes = JSON.parse(localStorage.getItem(RESUMES_KEY) || '[]');
  resumes = resumes.filter(r => r.id !== id);
  localStorage.setItem(RESUMES_KEY, JSON.stringify(resumes));
  loadResumes();
}

// 填充简历（复制到剪贴板）
function fillResume(id) {
  const resumes = JSON.parse(localStorage.getItem(RESUMES_KEY) || '[]');
  const resume = resumes.find(r => r.id === id);
  if (!resume) return;

  const mode = getSetting('autoFillMode', 'copy');
  if (mode === 'copy') {
    navigator.clipboard.writeText(resume.content).then(() => {
      alert('简历内容已复制到剪贴板，请粘贴到网申表单中！');
    });
  } else {
    alert('简历内容：\n\n' + resume.content);
  }
}

// 保存岗位
function saveJob() {
  const job = {
    id: Date.now(),
    title: document.getElementById('jobTitle').value.trim(),
    company: document.getElementById('companyName').value.trim(),
    location: document.getElementById('location').value.trim(),
    salary: document.getElementById('salary').value.trim(),
    requirements: document.getElementById('jobRequirements').value.trim(),
    createdAt: new Date().toISOString()
  };

  if (!job.title || !job.company) {
    alert('岗位名称和公司名称必填');
    return;
  }

  const jobs = JSON.parse(localStorage.getItem(JOBS_KEY) || '[]');
  jobs.push(job);
  localStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
  closeModal();
  loadJobs();
}

// 加载岗位列表
function loadJobs() {
  const jobs = JSON.parse(localStorage.getItem(JOBS_KEY) || '[]');
  const list = document.getElementById('job-list');
  list.innerHTML = '';

  jobs.forEach(j => {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <h3>${j.title}</h3>
      <p><strong>${j.company}</strong> · ${j.location} · ${j.salary || '面议'}</p>
      <p style="font-size: 0.9rem; color: #666;">${j.requirements.substring(0, 80)}${j.requirements.length > 80 ? '...' : ''}</p>
      <button class="fill-btn" onclick="copyJobInfo('${j.id}')">复制信息</button>
      <button class="delete-btn" onclick="deleteJob(${j.id})">×</button>
    `;
    list.appendChild(card);
  });

  document.getElementById('job-count').textContent = jobs.length;
}

// 复制岗位信息
function copyJobInfo(id) {
  const jobs = JSON.parse(localStorage.getItem(JOBS_KEY) || '[]');
  const job = jobs.find(j => j.id === id);
  if (!job) return;

  const info = `
岗位：${job.title}
公司：${job.company}
地点：${job.location}
薪资：${job.salary}
要求：${job.requirements}
  `.trim();

  navigator.clipboard.writeText(info).then(() => {
    alert('岗位信息已复制到剪贴板！');
  });
}

// 删除岗位
function deleteJob(id) {
  if (!confirm('确定删除？')) return;
  let jobs = JSON.parse(localStorage.getItem(JOBS_KEY) || '[]');
  jobs = jobs.filter(j => j.id !== id);
  localStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
  loadJobs();
}

// 设置
function saveSettings() {
  const settings = {
    autoFillMode: document.getElementById('autoFillMode').value,
    theme: document.getElementById('theme').value
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  applySettings(settings);
  alert('设置已保存！');
}

function loadSettings() {
  const saved = localStorage.getItem(SETTINGS_KEY);
  if (saved) {
    const settings = JSON.parse(saved);
    applySettings(settings);
  }
}

function applySettings(settings) {
  if (settings.theme === 'dark') {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }

  document.getElementById('autoFillMode').value = settings.autoFillMode || 'copy';
  document.getElementById('theme').value = settings.theme || 'light';
}

function getSetting(key, defaultValue) {
  const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  return settings[key] || defaultValue;
}

// 登录
function login() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  if (!email || !password) {
    alert('请输入邮箱和密码');
    return;
  }

  // 模拟登录（无真实验证）
  localStorage.setItem(USER_KEY, JSON.stringify({ email, logged: true }));
  document.getElementById('login-link').textContent = '👤 ' + email.split('@')[0];
  document.getElementById('login-link').href = '#dashboard';
  document.getElementById('logout-btn').style.display = 'flex';
  document.getElementById('login').classList.remove('active');
  document.getElementById('dashboard').classList.add('active');
  window.location.hash = '#dashboard';

  alert('登录成功！');
}

function checkLogin() {
  const user = localStorage.getItem(USER_KEY);
  if (user) {
    const { email } = JSON.parse(user);
    document.getElementById('login-link').textContent = '👤 ' + email.split('@')[0];
    document.getElementById('login-link').href = '#dashboard';
    document.getElementById('logout-btn').style.display = 'flex';
  }
}

// 退出登录
document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem(USER_KEY);
  document.getElementById('login-link').textContent = '登录';
  document.getElementById('login-link').href = '#login';
  document.getElementById('logout-btn').style.display = 'none';
  window.location.hash = '#login';
});

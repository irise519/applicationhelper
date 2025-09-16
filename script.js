// Import Firebase functions (via CDN, already loaded in HTML)
// We'll use the global firebase object from CDN

// Your Firebase config
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

// 设置 Firestore 使用 Web 格式（避免兼容性问题）
firebase.firestore().settings({ timestampsInSnapshots: true });

// 全局变量
const RESUMES_COLLECTION = 'resumes';
const JOBS_COLLECTION = 'jobs';
const SETTINGS_COLLECTION = 'settings';

// 初始化页面
document.addEventListener('DOMContentLoaded', () => {
  loadPage();
  setupAuthListener();
  loadSettings();
});

// 页面切换（保持不变）
function loadPage() {
  const urlHash = window.location.hash || '#dashboard';
  document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
  document.querySelectorAll('nav a').forEach(link => link.classList.remove('active'));

  const targetPage = document.querySelector(urlHash);
  if (targetPage) targetPage.classList.add('active');

  const activeLink = document.querySelector(`a[href="${urlHash}"]`);
  if (activeLink) activeLink.classList.add('active');
}

window.addEventListener('hashchange', loadPage);

// 模态框控制（保持不变）
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

// 提取文本（保持不变）
async function extractText(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const content = event.target.result;
    let text = '';

    if (file.name.endsWith('.pdf')) {
      text = "【PDF内容提取功能需集成 pdf.js】\n\n请手动复制粘贴简历内容。\n姓名：__________\n电话：__________\n邮箱：__________\n教育：__________\n工作经验：__________";
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

// 保存简历到 Firestore
async function saveResume() {
  const text = document.getElementById('resumeText').value.trim();
  if (!text) {
    alert('请填写简历内容');
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    alert('请先登录！');
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
}

// 加载简历（从 Firestore）
async function loadResumes() {
  const user = auth.currentUser;
  if (!user) {
    document.getElementById('resume-list').innerHTML = '<p>请登录以查看您的简历</p>';
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
      <button class="fill-btn" onclick="fillResume('${doc.id}')">一键填充</button>
      <button class="delete-btn" onclick="deleteResume('${doc.id}')">×</button>
    `;
    list.appendChild(card);
  });

  document.getElementById('resume-count').textContent = snapshot.size;
}

// 删除简历
async function deleteResume(id) {
  if (!confirm('确定删除？')) return;
  const user = auth.currentUser;
  if (!user) return;

  await db.collection(RESUMES_COLLECTION).doc(id).delete();
  loadResumes();
}

// 填充简历（复制到剪贴板）
function fillResume(id) {
  const mode = getSetting('autoFillMode', 'copy');
  const user = auth.currentUser;
  if (!user) return;

  db.collection(RESUMES_COLLECTION).doc(id).get().then(doc => {
    if (!doc.exists) return;
    const content = doc.data().content;

    if (mode === 'copy') {
      navigator.clipboard.writeText(content).then(() => {
        alert('简历内容已复制到剪贴板，请粘贴到网申表单中！');
      });
    } else {
      alert('简历内容：\n\n' + content);
    }
  });
}

// 保存岗位到 Firestore
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
    alert('请先登录！');
    return;
  }

  await db.collection(JOBS_COLLECTION).add({
    userId: user.uid,
    ...job
  });

  closeModal();
  loadJobs();
}

// 加载岗位（从 Firestore）
async function loadJobs() {
  const user = auth.currentUser;
  if (!user) {
    document.getElementById('job-list').innerHTML = '<p>请登录以查看您的岗位收藏</p>';
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
      alert('岗位信息已复制到剪贴板！');
    });
  });
}

// 删除岗位
async function deleteJob(id) {
  if (!confirm('确定删除？')) return;
  const user = auth.currentUser;
  if (!user) return;

  await db.collection(JOBS_COLLECTION).doc(id).delete();
  loadJobs();
}

// 设置（存储在 Firestore）
async function saveSettings() {
  const settings = {
    autoFillMode: document.getElementById('autoFillMode').value,
    theme: document.getElementById('theme').value
  };

  const user = auth.currentUser;
  if (!user) {
    alert('请先登录以保存设置');
    return;
  }

  await db.collection(SETTINGS_COLLECTION).doc(user.uid).set(settings, { merge: true });
  applySettings(settings);
  alert('设置已保存！');
}

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

  document.getElementById('autoFillMode').value = settings.autoFillMode || 'copy';
  document.getElementById('theme').value = settings.theme || 'light';
}

function getSetting(key, defaultValue) {
  const user = auth.currentUser;
  if (!user) return defaultValue;

  // 实际应从 Firestore 获取，此处为简化，用 localStorage 暂存
  const saved = localStorage.getItem(`settings_${user.uid}`);
  if (saved) {
    const settings = JSON.parse(saved);
    return settings[key] || defaultValue;
  }
  return defaultValue;
}

// 🔐 Firebase 认证处理
function setupAuthListener() {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      // 已登录
      document.getElementById('login-link').textContent = `👤 ${user.email.split('@')[0]}`;
      document.getElementById('login-link').href = '#dashboard';
      document.getElementById('logout-btn').style.display = 'flex';
      document.getElementById('login').classList.remove('active');
      loadResumes();
      loadJobs();
      loadSettings();
    } else {
      // 未登录
      document.getElementById('login-link').textContent = '登录';
      document.getElementById('login-link').href = '#login';
      document.getElementById('logout-btn').style.display = 'none';
      document.getElementById('resume-list').innerHTML = '<p>请登录以管理您的简历</p>';
      document.getElementById('job-list').innerHTML = '<p>请登录以收藏岗位</p>';
      document.getElementById('resume-count').textContent = '0';
      document.getElementById('job-count').textContent = '0';
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
    alert('登录成功！');
    window.location.hash = '#dashboard';
  } catch (error) {
    console.error(error);
    alert('登录失败：' + error.message);
  }
}

// 注册新用户
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
    console.error(error);
    alert('注册失败：' + error.message);
  }
}

// 退出登录
async function logout() {
  await auth.signOut();
  alert('已退出登录');
  window.location.hash = '#login';
}

// 在登录页绑定注册按钮
document.addEventListener('DOMContentLoaded', () => {
  const registerBtn = document.createElement('button');
  registerBtn.className = 'btn-primary';
  registerBtn.textContent = '注册新账号';
  registerBtn.onclick = register;
  registerBtn.style.marginTop = '1rem';

  const loginSection = document.getElementById('login');
  if (loginSection) {
    const form = loginSection.querySelector('.form-group:last-of-type');
    form.parentNode.insertBefore(registerBtn, form.nextSibling);
  }
});

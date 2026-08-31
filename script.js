const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzfHcnMzr4BmPwACaWxEOUnPV_KCT5yWyB15Ex4aww70n7skWiIHLoDT1imtICqEXdq/exec';

function showLoginSection() {
  document.getElementById('loginSection').classList.remove('hidden');
  document.getElementById('praiseSection').classList.add('hidden');
}

function showPraiseSection(writerName) {
  document.getElementById('loginSection').classList.add('hidden');
  document.getElementById('praiseSection').classList.remove('hidden');
  document.getElementById('welcomeText').textContent = `${writerName} 선생님, 반갑습니다.`;
  showTab('write');
}

function saveSession(writerName, sessionToken) {
  localStorage.setItem('deokbune_writer_name', writerName);
  localStorage.setItem('deokbune_session_token', sessionToken);
}

function getSession() {
  const writerName = localStorage.getItem('deokbune_writer_name');
  const sessionToken = localStorage.getItem('deokbune_session_token');
  return writerName && sessionToken ? { writerName, sessionToken } : null;
}

function clearSession() {
  localStorage.removeItem('deokbune_writer_name');
  localStorage.removeItem('deokbune_session_token');
}

function showTab(tabName) {
  const isWrite = tabName === 'write';
  document.getElementById('writePanel').classList.toggle('hidden', !isWrite);
  document.getElementById('receivedPanel').classList.toggle('hidden', isWrite);
  document.getElementById('writeTabBtn').classList.toggle('active', isWrite);
  document.getElementById('receivedTabBtn').classList.toggle('active', !isWrite);
  document.getElementById('writeTabBtn').setAttribute('aria-selected', String(isWrite));
  document.getElementById('receivedTabBtn').setAttribute('aria-selected', String(!isWrite));
}

function handleExpiredSession(message) {
  clearSession();
  showLoginSection();
  document.getElementById('loginMessage').textContent = message || '로그인 시간이 만료되었습니다. 다시 로그인해 주세요.';
}

function renderReceivedPraises(items) {
  const list = document.getElementById('receivedList');
  list.innerHTML = '';
  if (!items.length) {
    list.innerHTML = '<div class="empty-state">아직 받은 칭찬이 없습니다.</div>';
    return;
  }

  items.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'praise-card';
    const meta = document.createElement('div');
    meta.className = 'praise-meta';
    const category = document.createElement('span');
    category.className = 'category-badge';
    category.textContent = item.category;
    const date = document.createElement('time');
    date.textContent = item.createdAt;
    const detail = document.createElement('p');
    detail.className = 'praise-detail';
    detail.textContent = item.detailText;
    const anonymous = document.createElement('p');
    anonymous.className = 'anonymous-label';
    anonymous.textContent = '익명의 동료 교사로부터';
    meta.append(category, date);
    card.append(meta, detail, anonymous);
    list.appendChild(card);
  });
}

async function loadReceivedPraises() {
  const session = getSession();
  if (!session) return handleExpiredSession();
  const message = document.getElementById('receivedMessage');
  message.textContent = '받은 칭찬을 불러오는 중입니다...';
  try {
    const body = new URLSearchParams({ action: 'getReceivedPraises', sessionToken: session.sessionToken });
    const res = await fetch(SCRIPT_URL, { method: 'POST', body });
    const result = await res.json();
    if (!result.ok) {
      if (result.code === 'SESSION_EXPIRED') return handleExpiredSession(result.message);
      message.textContent = result.message || '받은 칭찬을 불러오지 못했습니다.';
      return;
    }
    message.textContent = '';
    renderReceivedPraises(result.data || []);
  } catch (err) {
    console.error(err);
    message.textContent = '받은 칭찬을 불러오는 중 오류가 발생했습니다.';
  }
}

async function loadConfig() {
  const loginMessage = document.getElementById('loginMessage');
  try {
    const res = await fetch(`${SCRIPT_URL}?action=config`);
    const result = await res.json();
    if (!result.ok) {
      loginMessage.textContent = result.message || '설정 정보를 불러오지 못했습니다.';
      return;
    }
    const teachers = (result.data && result.data.teachers) || [];
    const categories = (result.data && result.data.categories) || [];
    const teacherNameSelect = document.getElementById('teacherName');
    const nomineeNameSelect = document.getElementById('nomineeName');
    const categorySelect = document.getElementById('category');
    teacherNameSelect.innerHTML = '<option value="">선택하세요</option>';
    nomineeNameSelect.innerHTML = '<option value="">선택하세요</option>';
    categorySelect.innerHTML = '<option value="">선택하세요</option>';
    teachers.forEach((name) => {
      teacherNameSelect.add(new Option(name, name));
      nomineeNameSelect.add(new Option(name, name));
    });
    categories.forEach((category) => categorySelect.add(new Option(category, category)));
    const session = getSession();
    session ? showPraiseSection(session.writerName) : showLoginSection();
  } catch (err) {
    console.error(err);
    loginMessage.textContent = '설정 정보를 불러오는 중 오류가 발생했습니다.';
  }
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const loginMessage = document.getElementById('loginMessage');
  loginMessage.textContent = '로그인 중입니다...';
  try {
    const body = new URLSearchParams({
      action: 'login',
      teacherName: document.getElementById('teacherName').value,
      writerCode: document.getElementById('writerCode').value.trim()
    });
    const res = await fetch(SCRIPT_URL, { method: 'POST', body });
    const result = await res.json();
    if (!result.ok) {
      loginMessage.textContent = result.message || '로그인에 실패했습니다.';
      return;
    }
    saveSession(result.writerName, result.sessionToken);
    loginMessage.textContent = '';
    document.getElementById('loginForm').reset();
    showPraiseSection(result.writerName);
  } catch (err) {
    console.error(err);
    loginMessage.textContent = '로그인 중 오류가 발생했습니다.';
  }
});

document.getElementById('praiseForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const session = getSession();
  if (!session) return handleExpiredSession();
  const praiseMessage = document.getElementById('praiseMessage');
  const body = new URLSearchParams({
    action: 'submitPraise',
    sessionToken: session.sessionToken,
    nomineeName: document.getElementById('nomineeName').value,
    category: document.getElementById('category').value,
    detailText: document.getElementById('detailText').value.trim(),
    directConfirmed: document.getElementById('directConfirmed').checked ? 'true' : 'false'
  });
  praiseMessage.textContent = '저장 중입니다...';
  try {
    const res = await fetch(SCRIPT_URL, { method: 'POST', body });
    const result = await res.json();
    if (!result.ok) {
      if (result.code === 'SESSION_EXPIRED') return handleExpiredSession(result.message);
      praiseMessage.textContent = result.message || '오류가 발생했습니다.';
      return;
    }
    praiseMessage.textContent = '따뜻한 기록이 남겨졌습니다.';
    document.getElementById('praiseForm').reset();
  } catch (err) {
    console.error(err);
    praiseMessage.textContent = '전송 중 오류가 발생했습니다.';
  }
});

document.getElementById('writeTabBtn').addEventListener('click', () => showTab('write'));
document.getElementById('receivedTabBtn').addEventListener('click', () => {
  showTab('received');
  loadReceivedPraises();
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  clearSession();
  document.getElementById('praiseForm').reset();
  document.getElementById('praiseMessage').textContent = '';
  document.getElementById('receivedMessage').textContent = '';
  document.getElementById('receivedList').innerHTML = '';
  showLoginSection();
});

loadConfig();

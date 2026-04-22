const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzfHcnMzr4BmPwACaWxEOUnPV_KCT5yWyB15Ex4aww70n7skWiIHLoDT1imtICqEXdq/exec';

function showLoginSection() {
  document.getElementById('loginSection').classList.remove('hidden');
  document.getElementById('praiseSection').classList.add('hidden');
}

function showPraiseSection(writerName) {
  document.getElementById('loginSection').classList.add('hidden');
  document.getElementById('praiseSection').classList.remove('hidden');
  document.getElementById('welcomeText').textContent =
    `${writerName} 선생님, 고마운 순간을 남겨 주세요.`;
}

function saveSession(writerName) {
  localStorage.setItem('deokbune_writer_name', writerName);
}

function getSession() {
  return localStorage.getItem('deokbune_writer_name');
}

function clearSession() {
  localStorage.removeItem('deokbune_writer_name');
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

    const data = result.data || {};
    const teachers = data.teachers || [];
    const categories = data.categories || [];

    const teacherNameSelect = document.getElementById('teacherName');
    const nomineeNameSelect = document.getElementById('nomineeName');
    const categorySelect = document.getElementById('category');

    teacherNameSelect.innerHTML = '<option value="">선택하세요</option>';
    nomineeNameSelect.innerHTML = '<option value="">선택하세요</option>';
    categorySelect.innerHTML = '<option value="">선택하세요</option>';

    teachers.forEach((name) => {
      const opt1 = document.createElement('option');
      opt1.value = name;
      opt1.textContent = name;
      teacherNameSelect.appendChild(opt1);

      const opt2 = document.createElement('option');
      opt2.value = name;
      opt2.textContent = name;
      nomineeNameSelect.appendChild(opt2);
    });

    categories.forEach((category) => {
      const opt = document.createElement('option');
      opt.value = category;
      opt.textContent = category;
      categorySelect.appendChild(opt);
    });

    const sessionWriter = getSession();
    if (sessionWriter) {
      showPraiseSection(sessionWriter);
    } else {
      showLoginSection();
    }
  } catch (err) {
    console.error(err);
    loginMessage.textContent = '설정 정보를 불러오는 중 오류가 발생했습니다.';
  }
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const teacherName = document.getElementById('teacherName').value;
  const writerCode = document.getElementById('writerCode').value.trim();
  const loginMessage = document.getElementById('loginMessage');

  loginMessage.textContent = '로그인 중입니다...';

  try {
    const body = new URLSearchParams({
      action: 'login',
      teacherName,
      writerCode
    });

    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      body
    });

    const result = await res.json();

    if (!result.ok) {
      loginMessage.textContent = result.message || '로그인에 실패했습니다.';
      return;
    }

    saveSession(result.writerName);
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

  const writerName = getSession();
  const praiseMessage = document.getElementById('praiseMessage');

  const body = new URLSearchParams({
    action: 'submitPraise',
    writerName,
    nomineeName: document.getElementById('nomineeName').value,
    category: document.getElementById('category').value,
    detailText: document.getElementById('detailText').value.trim(),
    directConfirmed: document.getElementById('directConfirmed').checked ? 'true' : 'false'
  });

  praiseMessage.textContent = '저장 중입니다...';

  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      body
    });

    const result = await res.json();

    if (!result.ok) {
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

document.getElementById('logoutBtn').addEventListener('click', () => {
  clearSession();
  document.getElementById('praiseForm').reset();
  document.getElementById('praiseMessage').textContent = '';
  showLoginSection();
});

loadConfig();
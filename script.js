const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzztpY_-k0l0dxt2TL8p8N0lmIrxc6EDeN9vWhtixufbLn6_xvdX_d1YbGmbRBEUJFC/exec';

async function loadConfig() {
  const res = await fetch(`${SCRIPT_URL}?action=config`);
  const data = await res.json();

  const nomineeSelect = document.getElementById('nomineeName');
  const categorySelect = document.getElementById('category');

  nomineeSelect.innerHTML = '<option value="">선택하세요</option>';
  data.teachers.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    nomineeSelect.appendChild(opt);
  });

  categorySelect.innerHTML = '<option value="">선택하세요</option>';
  data.categories.forEach(category => {
    const opt = document.createElement('option');
    opt.value = category;
    opt.textContent = category;
    categorySelect.appendChild(opt);
  });
}

document.getElementById('praiseForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = {
    writerCode: document.getElementById('writerCode').value.trim(),
    nomineeName: document.getElementById('nomineeName').value,
    category: document.getElementById('category').value,
    detailText: document.getElementById('detailText').value.trim(),
    directConfirmed: document.getElementById('directConfirmed').checked
  };

  const message = document.getElementById('message');
  message.textContent = '저장 중입니다...';

  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();

    if (!result.ok) {
      message.textContent = result.message || '오류가 발생했습니다.';
      return;
    }

    message.textContent = '따뜻한 기록이 남겨졌습니다.';
    document.getElementById('praiseForm').reset();
  } catch (err) {
    message.textContent = '전송 중 오류가 발생했습니다.';
  }
});

loadConfig();
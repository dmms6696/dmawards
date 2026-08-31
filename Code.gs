const SHEET_SETTINGS = 'settings';
const SHEET_RAW = 'responses_raw';
const SHEET_SUMMARY = 'summary_teacher';
const SESSION_TTL_SECONDS = 21600;
const SESSION_PREFIX = 'session:';

const CATEGORIES = [
  '교과 수업', '학생 지도', '행정 업무', '공동체·협업',
  '대외 성과·학교 브랜딩', '숨은 기여·생활 배려'
];

function doGet(e) {
  const action = e && e.parameter ? String(e.parameter.action || '').trim() : '';
  if (action === 'config') return jsonOutput({ ok: true, data: getConfig_() });
  return jsonOutput({ ok: true, message: '덕분에 API 실행 중' });
}

function doPost(e) {
  try {
    const data = getRequestData_(e);
    const action = String(data.action || '').trim();
    if (action === 'login') return jsonOutput(login_(data));

    if (action === 'submitPraise') {
      data.writerName = requireSession_(data.sessionToken);
      validatePraisePayload_(data);
      const lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try {
        saveResponse_(data, isDuplicate_(data) ? 'Y' : 'N');
        updateSummary_();
      } finally {
        lock.releaseLock();
      }
      return jsonOutput({ ok: true, message: '따뜻한 기록이 저장되었습니다.' });
    }

    if (action === 'getReceivedPraises') {
      const teacherName = requireSession_(data.sessionToken);
      return jsonOutput({ ok: true, data: getReceivedPraises_(teacherName) });
    }
    throw new Error('올바르지 않은 요청입니다.');
  } catch (err) {
    const expired = err && err.message === 'SESSION_EXPIRED';
    return jsonOutput({
      ok: false,
      code: expired ? 'SESSION_EXPIRED' : 'REQUEST_ERROR',
      message: expired ? '로그인 시간이 만료되었습니다. 다시 로그인해 주세요.' : (err.message || '오류가 발생했습니다.')
    });
  }
}

function getRequestData_(e) {
  const data = {};
  if (e && e.parameter) Object.keys(e.parameter).forEach(function(k) { data[k] = e.parameter[k]; });
  if (e && e.postData && e.postData.contents) {
    try {
      const parsed = JSON.parse(String(e.postData.contents));
      Object.keys(parsed).forEach(function(k) { data[k] = parsed[k]; });
    } catch (ignored) {}
  }
  if (String(data.directConfirmed) === 'true') data.directConfirmed = true;
  if (String(data.directConfirmed) === 'false') data.directConfirmed = false;
  return data;
}

function getConfig_() {
  const values = getSheet_(SHEET_SETTINGS).getDataRange().getValues();
  const teachers = [];
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === 'teacher' && String(values[i][1]).trim() === 'name') {
      const name = String(values[i][2] || '').trim();
      if (name) teachers.push(name);
    }
  }
  return { teachers: teachers, categories: CATEGORIES };
}

function login_(data) {
  const teacherName = String(data.teacherName || '').trim();
  const writerCode = String(data.writerCode || '').trim();
  if (!teacherName) throw new Error('교사 이름을 선택해 주세요.');
  if (!writerCode) throw new Error('작성자 코드를 입력해 주세요.');
  const savedCode = getTeacherCode_(teacherName);
  if (!savedCode) throw new Error('등록되지 않은 교사입니다.');
  if (savedCode !== writerCode) throw new Error('작성자 코드가 올바르지 않습니다.');

  const token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put(SESSION_PREFIX + token, teacherName, SESSION_TTL_SECONDS);
  return { ok: true, message: '로그인되었습니다.', writerName: teacherName, sessionToken: token };
}

function requireSession_(sessionToken) {
  const token = String(sessionToken || '').trim();
  if (!token) throw new Error('SESSION_EXPIRED');
  const cache = CacheService.getScriptCache();
  const teacherName = cache.get(SESSION_PREFIX + token);
  if (!teacherName) throw new Error('SESSION_EXPIRED');
  cache.put(SESSION_PREFIX + token, teacherName, SESSION_TTL_SECONDS);
  return teacherName;
}

function getTeacherCode_(teacherName) {
  const values = getSheet_(SHEET_SETTINGS).getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === 'teacherCode' && String(values[i][1]).trim() === teacherName) {
      return String(values[i][2] || '').trim();
    }
  }
  return '';
}

function validatePraisePayload_(data) {
  const nominee = String(data.nomineeName || '').trim();
  const category = String(data.category || '').trim();
  const detail = String(data.detailText || '').trim();
  if (!data.writerName) throw new Error('로그인 정보가 없습니다. 다시 로그인해 주세요.');
  if (!nominee) throw new Error('대상 교사를 선택해 주세요.');
  if (!category || !CATEGORIES.includes(category)) throw new Error('올바른 카테고리를 선택해 주세요.');
  if (detail.length < 20) throw new Error('구체적인 내용을 20자 이상 적어 주세요.');
  if (data.directConfirmed !== true) throw new Error('직접 경험 확인에 체크해 주세요.');
}

function getReceivedPraises_(teacherName) {
  const values = getSheet_(SHEET_RAW).getDataRange().getValues();
  const timeZone = Session.getScriptTimeZone() || 'Asia/Seoul';
  const result = [];
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][2] || '').trim() !== teacherName) continue;
    if (String(values[i][7] || '').trim() === '반려') continue;
    const timestamp = values[i][0];
    result.push({
      sortTime: timestamp instanceof Date ? timestamp.getTime() : 0,
      createdAt: timestamp instanceof Date ? Utilities.formatDate(timestamp, timeZone, 'yyyy. M. d.') : '',
      category: String(values[i][3] || '').trim(),
      detailText: String(values[i][4] || '').trim()
    });
  }
  result.sort(function(a, b) { return b.sortTime - a.sortTime; });
  return result.map(function(item) {
    return { createdAt: item.createdAt, category: item.category, detailText: item.detailText };
  });
}

function saveResponse_(data, duplicateFlag) {
  getSheet_(SHEET_RAW).appendRow([
    new Date(), data.writerName, String(data.nomineeName).trim(), String(data.category).trim(),
    String(data.detailText).trim(), 'Y', duplicateFlag, '미검토'
  ]);
}

function isDuplicate_(data) {
  const values = getSheet_(SHEET_RAW).getDataRange().getValues();
  const now = Date.now();
  const windowMs = 14 * 24 * 60 * 60 * 1000;
  for (let i = 1; i < values.length; i++) {
    const same = String(values[i][1]).trim() === data.writerName &&
      String(values[i][2]).trim() === String(data.nomineeName).trim() &&
      String(values[i][3]).trim() === String(data.category).trim();
    if (same && Math.abs(now - new Date(values[i][0]).getTime()) <= windowMs) return true;
  }
  return false;
}

function updateSummary_() {
  const rows = getSheet_(SHEET_RAW).getDataRange().getValues().slice(1);
  const map = {};
  rows.forEach(function(row) {
    const nominee = String(row[2] || '').trim();
    if (!nominee) return;
    if (!map[nominee]) map[nominee] = { total: 0, writers: new Set(), counts: [0, 0, 0, 0, 0, 0], lengths: [], duplicates: 0 };
    const item = map[nominee];
    item.total++;
    if (row[1]) item.writers.add(String(row[1]).trim());
    const categoryIndex = CATEGORIES.indexOf(String(row[3] || '').trim());
    if (categoryIndex >= 0) item.counts[categoryIndex]++;
    item.lengths.push(String(row[4] || '').length);
    if (String(row[6] || '').trim() === 'Y') item.duplicates++;
  });

  const output = [['nominee_name', 'total_entries', 'unique_writers', 'class_count', 'student_guidance_count', 'admin_count', 'collaboration_count', 'branding_count', 'hidden_count', 'avg_detail_length', 'duplicate_entries']];
  Object.keys(map).sort().forEach(function(name) {
    const item = map[name];
    const average = item.lengths.length ? item.lengths.reduce(function(a, b) { return a + b; }, 0) / item.lengths.length : 0;
    output.push([name, item.total, item.writers.size].concat(item.counts, [Math.round(average * 10) / 10, item.duplicates]));
  });
  const sheet = getSheet_(SHEET_SUMMARY);
  sheet.clearContents();
  sheet.getRange(1, 1, output.length, output[0].length).setValues(output);
}

function getSheet_(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error(name + ' 시트를 찾을 수 없습니다.');
  return sheet;
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

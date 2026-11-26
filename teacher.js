import { openStore } from './store.js?v=6';
import { pipSupported, openPip, autoMini } from './pip.js?v=8';
import { DEFAULT_REASONS, MAX_REASONS } from './reasons.js?v=11';

// 요소를 미리 모아 둬요. 작은 창(PiP)으로 옮겨도 그대로 찾을 수 있게.
const byId = {};
document.querySelectorAll('[id]').forEach((e) => { byId[e.id] = e; });
const $ = (id) => byId[id];
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

const store = await openStore();
if (store.mode === 'demo') $('demo').hidden = false;

const SAMPLE = {
  current: 0,
  steps: [
    { title: '캐릭터 만들기', desc: '새 프로젝트를 만들고 캐릭터를 하나 그리거나 골라 보세요.' },
    { title: '움직이게 하기', desc: '캐릭터를 누르면 움직이도록 블록을 이어 보세요.' },
    { title: '소리 넣기', desc: '움직일 때 소리가 나도록 소리 블록을 넣어 보세요.' },
  ],
};

let room = localStorage.getItem('helpnote-room') || randomRoom();
let task = null;
let students = {};
let subs = [];
let lastHelpIds = new Set();

function randomRoom() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function openRoom() {
  localStorage.setItem('helpnote-room', room);
  subs.forEach((u) => typeof u === 'function' && u());
  subs = [];
  task = null;
  $('roomCode').textContent = room;
  const url = new URL('index.html?room=' + room, location.href).href;
  $('studentLink').textContent = url;
  $('studentLink').href = url;

  subs.push(store.on(`rooms/${room}/task`, (t) => {
    if (task) return; // 할 일은 선생님 화면이 기준: 처음 한 번만 불러와요
    task = t && t.steps ? t : structuredClone(SAMPLE);
    if (!Array.isArray(task.reasons) || !task.reasons.length) task.reasons = structuredClone(DEFAULT_REASONS);
    if (!t || !t.reasons) saveTask();
    renderSteps();
    renderReasons();
  }));
  subs.push(store.on(`rooms/${room}/students`, (s) => {
    students = s || {};
    renderStudents();
  }));
}

/* ── 할 일 단계 ── */
let saveTimer;
function saveTask(delay = 0) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => store.set(`rooms/${room}/task`, task), delay);
}

function setCurrent(i) {
  task.current = Math.max(0, Math.min(i, task.steps.length - 1));
  saveTask();
  renderSteps();
  renderStudents();
}

function renderSteps() {
  const box = $('stepsEditor');
  box.replaceChildren();
  task.steps.forEach((s, i) => {
    const isCur = i === task.current;
    const card = el('li', 'step' + (isCur ? ' current' : i < task.current ? ' past' : ''));
    const num = el('button', 'step-num', String(i + 1));
    num.title = isCur ? '지금 아이들 메모지에 떠 있는 단계' : '이 단계를 아이들 메모지에 띄우기';
    num.setAttribute('aria-label', `${i + 1}단계를 아이들 메모지에 띄우기`);
    num.onclick = () => setCurrent(i);
    const body = el('div', 'step-body');
    const title = el('input', 'step-title');
    title.value = s.title || '';
    title.placeholder = '단계 이름';
    title.setAttribute('aria-label', `${i + 1}단계 이름`);
    title.oninput = () => { s.title = title.value; saveTask(600); };
    const del = el('button', 'step-del', '지우기');
    del.title = '단계 지우기';
    del.onclick = () => {
      if (!confirm(`${i + 1}단계를 지울까요?`)) return;
      task.steps.splice(i, 1);
      if (task.current >= task.steps.length) task.current = Math.max(0, task.steps.length - 1);
      saveTask();
      renderSteps();
    };
    const desc = el('textarea', 'step-desc');
    desc.rows = 2;
    desc.value = s.desc || '';
    desc.placeholder = '아이들에게 보여줄 설명';
    desc.setAttribute('aria-label', `${i + 1}단계 설명`);
    desc.oninput = () => { s.desc = desc.value; saveTask(600); };
    const top = el('div', 'step-top');
    top.append(title);
    if (isCur) top.append(el('span', 'live', '아이들 화면에 떠 있어요'));
    top.append(del);
    body.append(top, desc);
    card.append(num, body);
    box.append(card);
  });
  const n = task.steps.length;
  $('curLabel').textContent = n ? `${task.current + 1} / ${n}` : '단계 없음';
  $('prev').disabled = task.current <= 0;
  $('next').disabled = task.current >= n - 1;
}

$('prev').onclick = () => setCurrent(task.current - 1);
$('next').onclick = () => setCurrent(task.current + 1);
$('addStep').onclick = () => {
  task.steps.push({ title: '', desc: '' });
  saveTask();
  renderSteps();
  const inputs = $('stepsEditor').querySelectorAll('input');
  inputs[inputs.length - 1].focus();
};

/* ── 도움 버튼 편집 ── */
function renderReasons() {
  const box = $('reasonsEditor');
  box.replaceChildren();
  task.reasons.forEach((r, i) => {
    const row = el('li', 'reason-edit');
    const icon = el('input', 'reason-icon-input');
    icon.value = r.icon || '';
    icon.maxLength = 4;
    icon.setAttribute('aria-label', `${i + 1}번 버튼 그림`);
    icon.oninput = () => { r.icon = icon.value.trim(); saveTask(600); };
    const label = el('input', 'reason-label-input');
    label.value = r.label || '';
    label.maxLength = 20;
    label.placeholder = '버튼 이름';
    label.setAttribute('aria-label', `${i + 1}번 버튼 이름`);
    label.oninput = () => { r.label = label.value; saveTask(600); };
    const urgentWrap = el('label', 'reason-urgent');
    const urgent = el('input');
    urgent.type = 'checkbox';
    urgent.checked = !!r.urgent;
    urgent.onchange = () => { r.urgent = urgent.checked; saveTask(); };
    urgentWrap.append(urgent, document.createTextNode('급해요'));
    urgentWrap.title = '체크하면 이 버튼을 누른 아이가 도움 요청 맨 위에 보여요';
    const del = el('button', 'step-del', '지우기');
    del.onclick = () => {
      if (task.reasons.length <= 1) return alert('버튼은 하나 이상 있어야 해요.');
      task.reasons.splice(i, 1);
      saveTask();
      renderReasons();
    };
    row.append(icon, label, urgentWrap, del);
    box.append(row);
  });
  $('addReason').disabled = task.reasons.length >= MAX_REASONS;
}
$('addReason').onclick = () => {
  if (task.reasons.length >= MAX_REASONS) return;
  task.reasons.push({ icon: '🙋', label: '' });
  saveTask();
  renderReasons();
  const inputs = $('reasonsEditor').querySelectorAll('.reason-label-input');
  inputs[inputs.length - 1].focus();
};
$('resetReasons').onclick = () => {
  if (!confirm('도움 버튼을 처음 6개로 되돌릴까요?')) return;
  task.reasons = structuredClone(DEFAULT_REASONS);
  saveTask();
  renderReasons();
};

/* ── 학생 / 도움 요청 ── */
const waitMin = (t) => Math.max(0, Math.floor((Date.now() - t) / 60000));

function renderStudents() {
  const list = Object.entries(students).map(([id, s]) => ({ id, ...s }));
  const cur = task ? task.current : 0;
  // 급한 요청(저장 문제 등)은 맨 위, 나머지는 먼저 부른 순서
  const helps = list.filter((s) => s.help).sort((a, b) =>
    (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0) || (a.helpAt || 0) - (b.helpAt || 0));

  const hl = $('helpList');
  hl.replaceChildren();
  if (!helps.length) hl.append(el('li', 'queue-empty', '지금은 도움을 기다리는 아이가 없어요.'));
  helps.forEach((s) => {
    const m = waitMin(s.helpAt || Date.now());
    const row = el('li', 'ask' + (s.urgent ? ' urgent' : m >= 5 ? ' long' : m >= 2 ? ' mid' : ''));
    const wait = el('div', 'ask-wait');
    wait.append(el('b', '', m < 1 ? '방금' : String(m)), el('span', '', m < 1 ? '' : '분째'));
    const main = el('div', 'ask-main');
    const who = el('div', 'ask-who', s.name || '이름 없음');
    who.append(el('span', 'ask-step', `${(s.helpStep ?? 0) + 1}단계`));
    main.append(who);
    const msg = el('div', 'ask-msg' + (s.msg ? '' : ' none'));
    if (s.icon) msg.append(el('span', 'ask-icon', s.icon));
    msg.append(document.createTextNode(s.msg || '그냥 불렀어요'));
    if (s.urgent) msg.append(el('span', 'ask-urgent', '급해요'));
    main.append(msg);
    const btn = el('button', 'ask-done', '해결');
    btn.setAttribute('aria-label', `${s.name || '이 아이'} 도움 요청 해결`);
    btn.onclick = () => store.update(`rooms/${room}/students/${s.id}`, { help: false, msg: '', icon: '', urgent: false });
    row.append(wait, main, btn);
    hl.append(row);
  });
  // 같은 버튼을 3명 이상 누르면 전체 설명이 필요하다는 신호
  const groups = {};
  helps.forEach((s) => { if (s.msg) (groups[s.msg] ||= { icon: s.icon, n: 0 }).n++; });
  const many = Object.entries(groups).filter(([, g]) => g.n >= 3).sort((a, b) => b[1].n - a[1].n);
  $('clusters').replaceChildren(...many.map(([label, g]) => {
    const c = el('div', 'cluster');
    c.append(el('b', '', `${g.icon ? g.icon + ' ' : ''}${label}`), el('span', '', ` ${g.n}명이 같은 도움을 기다려요. 다 같이 설명해 보세요.`));
    return c;
  }));
  $('clusters').hidden = !many.length;

  $('helpCount').textContent = helps.length;
  $('helpCount').classList.toggle('hot', helps.length > 0);
  document.title = helps.length ? `(${helps.length}) 도움 요청 · 도움 메모` : '도움 메모 · 선생님';

  const ids = new Set(helps.map((s) => s.id));
  if ([...ids].some((id) => !lastHelpIds.has(id))) ding();
  lastHelpIds = ids;

  const box = $('students');
  box.replaceChildren();
  list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
  if (!list.length) box.append(el('div', 'roster-empty', `아이들이 방 번호 ${room}으로 들어오면 여기에 이름이 생겨요.`));
  let done = 0;
  list.forEach((s) => {
    const isDone = s.doneStep === cur;
    if (isDone) done++;
    const state = s.help ? 'help' : isDone ? 'done' : 'doing';
    const tile = el('span', `kid ${state}`, s.name || '이름 없음');
    tile.title = s.help ? '도움을 기다리는 중' : isDone ? `${cur + 1}단계를 다 했어요` : `${cur + 1}단계를 하는 중`;
    box.append(tile);
  });
  $('doneCount').textContent = list.length ? `${cur + 1}단계 끝낸 아이 ${done} / ${list.length}명` : '';
  $('doneBar').style.width = list.length ? `${(done / list.length) * 100}%` : '0';
}

let audio;
function ding() {
  try {
    audio = audio || new AudioContext();
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.15, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.4);
    o.connect(g).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + 0.4);
  } catch { /* 소리를 못 내도 괜찮아요 */ }
}
document.addEventListener('click', () => { audio = audio || new AudioContext(); }, { once: true });

setInterval(renderStudents, 30000); // "n분 전" 갱신

$('newRoom').onclick = () => {
  const v = prompt('새 방 번호 (숫자 3~6자리). 비워 두면 새로 만들어요.', '');
  if (v === null) return;
  const code = v.trim() || randomRoom();
  if (!/^\d{3,6}$/.test(code)) return alert('숫자 3~6자리로 써 주세요.');
  room = code;
  openRoom();
};
$('copy').onclick = async () => {
  try { await navigator.clipboard.writeText($('studentLink').href); $('copy').textContent = '복사됨!'; }
  catch { prompt('주소를 복사하세요', $('studentLink').href); }
  setTimeout(() => ($('copy').textContent = '복사'), 1500);
};
$('clearStudents').onclick = () => {
  if (!confirm('학생 목록과 도움 요청을 모두 지울까요? (새 수업을 시작할 때)')) return;
  store.remove(`rooms/${room}/students`);
};

autoMini();
$('pipBtn').hidden = false;
$('pipBtn').onclick = () => openPip({ el: $('helpBox'), placeholder: $('pipHere'), cls: 'teacher', width: 320, height: 360 });

openRoom();

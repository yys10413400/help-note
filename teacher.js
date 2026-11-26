import { openStore } from './store.js';
import { pipSupported, openPip, autoMini } from './pip.js?v=5';

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
    if (!t) saveTask();
    renderSteps();
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
    const card = el('div', 'stepedit' + (i === task.current ? ' current' : ''));
    const head = el('div', 'head');
    const num = el('button', 'num', i === task.current ? `▶ ${i + 1}단계` : `${i + 1}단계`);
    num.title = '이 단계를 지금 할 일로 보내기';
    num.onclick = () => setCurrent(i);
    const title = el('input');
    title.value = s.title || '';
    title.placeholder = '단계 이름';
    title.oninput = () => { s.title = title.value; saveTask(600); };
    const del = el('button', 'del', '✕');
    del.title = '단계 지우기';
    del.onclick = () => {
      if (!confirm(`${i + 1}단계를 지울까요?`)) return;
      task.steps.splice(i, 1);
      if (task.current >= task.steps.length) task.current = Math.max(0, task.steps.length - 1);
      saveTask();
      renderSteps();
    };
    head.append(num, title, del);
    const desc = el('textarea');
    desc.rows = 2;
    desc.value = s.desc || '';
    desc.placeholder = '아이들에게 보여줄 설명';
    desc.oninput = () => { s.desc = desc.value; saveTask(600); };
    card.append(head, desc);
    box.append(card);
  });
  const n = task.steps.length;
  $('curLabel').textContent = n ? `지금 ${task.current + 1} / ${n} 단계` : '단계를 추가해 주세요';
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

/* ── 학생 / 도움 요청 ── */
function ago(t) {
  const m = Math.floor((Date.now() - t) / 60000);
  return m < 1 ? '방금' : `${m}분 전`;
}

function renderStudents() {
  const list = Object.entries(students).map(([id, s]) => ({ id, ...s }));
  const cur = task ? task.current : 0;
  const helps = list.filter((s) => s.help).sort((a, b) => (a.helpAt || 0) - (b.helpAt || 0));

  const hl = $('helpList');
  hl.replaceChildren();
  if (!helps.length) hl.append(el('div', 'empty', '도움 요청이 없어요 🙂'));
  helps.forEach((s) => {
    const card = el('div', 'helpcard');
    const grow = el('div', 'grow');
    grow.append(el('div', 'who', s.name || '이름 없음'));
    if (s.msg) grow.append(el('div', 'msg', `“${s.msg}”`));
    grow.append(el('div', 'meta', `${(s.helpStep ?? 0) + 1}단계 · ${ago(s.helpAt || Date.now())}`));
    const btn = el('button', '', '해결했어요');
    btn.onclick = () => store.update(`rooms/${room}/students/${s.id}`, { help: false, msg: '' });
    card.append(grow, btn);
    hl.append(card);
  });
  $('helpCount').textContent = helps.length;
  $('helpCount').classList.toggle('hot', helps.length > 0);
  document.title = helps.length ? `(${helps.length}) 도움 요청 · 도움 메모` : '도움 메모 · 선생님';

  const ids = new Set(helps.map((s) => s.id));
  if ([...ids].some((id) => !lastHelpIds.has(id))) ding();
  lastHelpIds = ids;

  const box = $('students');
  box.replaceChildren();
  list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
  if (!list.length) box.append(el('div', 'empty', `아이들이 방 번호 ${room}으로 들어오면 여기에 보여요`));
  let done = 0;
  list.forEach((s) => {
    const isDone = s.doneStep === cur;
    if (isDone) done++;
    const chip = el('span', 'chip' + (s.help ? ' help' : isDone ? ' done' : ''),
      (s.help ? '🙋 ' : isDone ? '✅ ' : '') + (s.name || '이름 없음'));
    box.append(chip);
  });
  $('doneCount').textContent = list.length ? `${cur + 1}단계 완료 ${done} / ${list.length}명` : '';
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

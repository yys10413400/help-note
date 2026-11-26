import { openStore } from './store.js?v=6';
import { pipSupported, openPip, autoMini } from './pip.js?v=8';
import { reasonsOf } from './reasons.js?v=11';

// 요소를 미리 모아 둬요. 작은 창(PiP)으로 옮겨도 그대로 찾을 수 있게.
const byId = {};
document.querySelectorAll('[id]').forEach((e) => { byId[e.id] = e; });
const $ = (id) => byId[id];

// 바탕화면 프로그램(desktop 폴더) 안에서 열렸을 때: 테두리 없는 창이라 위에 끌기 막대와 버튼을 달아요
const desktopApp = window.desktopApp;
if (desktopApp) {
  document.body.classList.add('app');
  $('appbar').hidden = false;
  $('appMin').onclick = () => desktopApp.minimize();
  $('appClose').onclick = () => desktopApp.close();
}

const store = await openStore();
if (store.mode === 'demo') $('demo').hidden = false;

const ME_KEY = 'helpnote-me';
const params = new URLSearchParams(location.search);
const urlRoom = params.get('room');
let me = JSON.parse(localStorage.getItem(ME_KEY) || 'null');
if (me && urlRoom && urlRoom !== me.room) me = null;
if (urlRoom) $('room').value = urlRoom;

let task = null;
let mine = null;
let subs = [];

const newId = () =>
  (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 12);
const myPath = () => `rooms/${me.room}/students/${me.id}`;

function showJoin() {
  subs.forEach((u) => typeof u === 'function' && u());
  subs = [];
  $('join').hidden = false;
  $('app').hidden = true;
  $('name').value = me ? me.name : '';
}

async function start() {
  localStorage.setItem(ME_KEY, JSON.stringify(me));
  await store.update(myPath(), { name: me.name, joinedAt: Date.now() });
  $('join').hidden = true;
  $('app').hidden = false;
  $('me').textContent = me.name;
  subs.push(store.on(`rooms/${me.room}/task`, (t) => { task = t; render(); }));
  subs.push(store.on(myPath(), (s) => {
    if (s === null) { showJoin(); return; } // 선생님이 학생 목록을 비움
    mine = s;
    render();
  }));
}

let lastStamp = null; // 도장은 방금 누른 때만 쾅 찍히는 움직임을 보여줘요

function render() {
  const steps = (task && task.steps) || [];
  const cur = Math.min((task && task.current) || 0, Math.max(steps.length - 1, 0));
  const step = steps[cur];
  if (!step) {
    $('stepNo').textContent = '잠깐만요';
    $('title').textContent = '선생님이 할 일을 준비하고 있어요';
    $('desc').textContent = '';
  } else {
    $('stepNo').textContent = `${cur + 1}단계`;
    $('title').textContent = step.title || '';
    $('desc').textContent = step.desc || '';
  }
  // 단계 진행 점: 지난 단계 ● 지금 ◉ 남은 단계 ○
  $('dots').replaceChildren(...steps.map((_, i) => {
    const d = document.createElement('i');
    d.className = i < cur ? 'past' : i === cur ? 'now' : '';
    return d;
  }));
  const done = !!(mine && mine.doneStep === cur && step);
  $('doneBtn').textContent = done ? '아직이에요' : '다 했어요';
  $('doneBtn').classList.toggle('on', done);
  $('doneBtn').disabled = !step;
  const stampKey = done ? `${cur}` : '';
  $('stamp').hidden = !done;
  $('note').classList.toggle('is-done', done);
  $('stamp').classList.toggle('fresh', done && stampKey !== lastStamp && lastStamp !== null);
  lastStamp = stampKey;

  const helping = !!(mine && mine.help);
  $('waiting').hidden = !helping;
  $('myMsg').textContent = helping && mine.msg ? `${mine.icon ? mine.icon + ' ' : ''}${mine.msg}` : '';
  $('actions').hidden = helping || !$('helpForm').hidden;
  if (helping) $('helpForm').hidden = true;
}

const currentIndex = () => (task && task.current) || 0;

$('joinBtn').onclick = () => {
  const room = $('room').value.trim();
  const name = $('name').value.trim();
  if (!/^\d{3,6}$/.test(room)) return alert('방 번호를 확인해 주세요.');
  if (!name) return alert('이름을 써 주세요.');
  me = { room, name, id: (me && me.room === room && me.id) || newId() };
  start();
};
$('name').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('joinBtn').click(); });

$('doneBtn').onclick = () => {
  const cur = currentIndex();
  const done = mine && mine.doneStep === cur;
  store.update(myPath(), { doneStep: done ? -1 : cur });
};

// 도와주세요 → 이유 버튼을 하나 누르면 바로 선생님께 가요 (글쓰기 없음)
$('helpBtn').onclick = () => {
  const box = $('reasons');
  box.replaceChildren(...reasonsOf(task).map((r) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'reason';
    const icon = document.createElement('span');
    icon.className = 'reason-icon';
    icon.textContent = r.icon || '🙋';
    icon.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.textContent = r.label || '도와주세요';
    b.append(icon, label);
    b.onclick = () => {
      $('helpForm').hidden = true;
      store.update(myPath(), {
        help: true, msg: r.label || '도와주세요', icon: r.icon || '🙋', urgent: !!r.urgent,
        helpAt: Date.now(), helpStep: currentIndex(),
      });
    };
    return b;
  }));
  $('helpForm').hidden = false;
  $('actions').hidden = true;
  box.firstChild && box.firstChild.focus();
};
$('cancelHelp').onclick = () => { $('helpForm').hidden = true; render(); };
$('solved').onclick = () => store.update(myPath(), { help: false, msg: '', icon: '', urgent: false });

$('leave').onclick = () => {
  if (!confirm('나갈까요?')) return;
  store.remove(myPath());
  localStorage.removeItem(ME_KEY);
  me = null;
  showJoin();
};

/* ── 작게 보기 ── */
autoMini();
$('pipBtn').hidden = !!desktopApp; // 프로그램은 이미 늘 맨 위에 있어요
$('pipBtn').onclick = () => openPip({ el: $('app'), placeholder: $('pipHere'), cls: 'student', width: 340, height: 330 });

if (me) start(); else showJoin();

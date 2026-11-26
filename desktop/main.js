// 도움 메모 바탕화면 프로그램: 테두리 없는 작은 메모지 창이 늘 맨 위에 떠 있어요.
const { app, BrowserWindow, ipcMain, screen, shell } = require('electron');
const path = require('path');

const PAGE = process.env.HELPNOTE_URL || 'https://yys10413400.github.io/help-note/index.html?app=1';

if (!app.requestSingleInstanceLock()) app.quit();

let win;

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  const w = 340;
  const h = 340;
  win = new BrowserWindow({
    width: w,
    height: h,
    x: workArea.x + workArea.width - w - 16, // 오른쪽 아래 구석
    y: workArea.y + workArea.height - h - 16,
    minWidth: 260,
    minHeight: 200,
    frame: false,
    alwaysOnTop: true,
    backgroundColor: '#f3efe6',
    title: '도움 메모',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.setAlwaysOnTop(true, 'screen-saver'); // 전체 화면 프로그램 위에도
  win.setMenu(null);
  win.loadURL(PAGE);

  // 인터넷이 안 되면 안내 화면
  win.webContents.on('did-fail-load', (_e, _code, _desc, _url, isMainFrame) => {
    if (isMainFrame) win.loadFile(path.join(__dirname, 'offline.html'));
  });
  // 링크는 프로그램 안이 아니라 기본 브라우저로
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
}

ipcMain.on('win', (_e, cmd) => {
  if (!win) return;
  if (cmd === 'min') win.minimize();
  if (cmd === 'close') win.close();
  if (cmd === 'retry') win.loadURL(PAGE);
});

app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

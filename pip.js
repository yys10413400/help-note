// PC 크롬·엣지: 다른 창 위에 항상 떠 있는 작은 창(Document Picture-in-Picture)
export const pipSupported = 'documentPictureInPicture' in window;

export async function openPip({ el, placeholder, cls, width, height }) {
  if (window.documentPictureInPicture.window) return; // 이미 열려 있어요
  let pip;
  try {
    pip = await window.documentPictureInPicture.requestWindow({ width, height });
  } catch (e) {
    console.error(e);
    alert('이 브라우저에서는 작은 창을 띄울 수 없어요. PC의 크롬이나 엣지에서 열어 주세요.');
    return;
  }
  const link = pip.document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('style.css', location.href).href;
  pip.document.head.append(link);
  pip.document.title = '도움 메모';
  pip.document.body.className = `${cls} mini pip`;
  const home = el.parentNode;
  const next = el.nextSibling;
  pip.document.body.append(el);
  if (placeholder) placeholder.hidden = false;
  pip.addEventListener('pagehide', () => {
    home.insertBefore(el, next);
    if (placeholder) placeholder.hidden = true;
  });
}

// 창이 작으면(갤럭시 팝업 화면, 화면 분할) 자동으로 작은 모양
export function autoMini() {
  const fit = () => document.body.classList.toggle('mini', innerWidth < 480 || innerHeight < 520);
  addEventListener('resize', fit);
  fit();
}

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopApp', {
  minimize: () => ipcRenderer.send('win', 'min'),
  close: () => ipcRenderer.send('win', 'close'),
  retry: () => ipcRenderer.send('win', 'retry'),
});

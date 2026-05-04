const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('klinch', {
  platform: process.platform,
  isDev: process.env.KLINCH_IS_DEV === '1',
  deepgramKey: process.env.DEEPGRAM_API_KEY,
  send: (channel, data) => ipcRenderer.send(channel, data),
  on: (channel, callback) => {
    const handler = (_event, ...args) => callback(...args);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),
});

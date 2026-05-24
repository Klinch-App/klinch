const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('klinch', {
  platform:        process.platform,
  appVersion:      process.env.APP_VERSION || '',
  isDev:           process.env.KLINCH_IS_DEV === '1',
  deepgramKey:     process.env.DEEPGRAM_API_KEY,
  logoDevKey:      process.env.LOGO_DEV_API_KEY || '',
  // Exposed so the renderer can create its own Supabase client (anon key is public)
  supabaseUrl:     process.env.SUPABASE_URL     || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  googleClientId:  process.env.GOOGLE_CLIENT_ID  || '',
  send:   (channel, data) => ipcRenderer.send(channel, data),
  on:     (channel, callback) => {
    const handler = (_event, ...args) => callback(...args);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),
});

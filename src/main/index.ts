import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1400, height: 900, title: 'QA Office',
    backgroundColor: '#13151d',
    webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, sandbox: false },
  });
  if (process.env['ELECTRON_RENDERER_URL']) win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  else win.loadFile(join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

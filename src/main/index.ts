import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';
import { Observatory } from './observatory';
import { IPC, type OfficeState } from '../shared/types';

let win: BrowserWindow | undefined;
let quitting = false;
const configFile = join(app.isPackaged ? app.getPath('userData') : process.cwd(), 'office.config.json');
const obs = new Observatory(configFile);

function send(s: OfficeState): void {
  if (win && !win.isDestroyed()) win.webContents.send(IPC.state, s);
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1400, height: 900, title: 'QA Office', backgroundColor: '#13151d',
    webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, sandbox: false },
  });
  if (process.env['ELECTRON_RENDERER_URL']) void win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  else void win.loadFile(join(__dirname, '../renderer/index.html'));
  win.webContents.on('did-finish-load', () => send(obs.state()));
  win.on('closed', () => { win = undefined; });
}

app.whenReady().then(async () => {
  obs.store.on('change', send);
  ipcMain.on(IPC.requestState, () => send(obs.state()));
  ipcMain.on(IPC.assignFolder, (_e, cwd: string, stationId: string) => {
    if (typeof cwd === 'string' && typeof stationId === 'string') obs.assignFolder(cwd, stationId);
  });
  createWindow();
  await obs.start();
});
app.on('window-all-closed', () => {
  if (quitting) return; quitting = true;
  void obs.stop().catch(() => undefined).finally(() => app.quit());
});

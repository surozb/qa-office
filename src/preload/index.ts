import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type OfficeState } from '../shared/types';

contextBridge.exposeInMainWorld('office', {
  onState(cb: (s: OfficeState) => void): () => void {
    const h = (_e: unknown, s: OfficeState) => cb(s);
    ipcRenderer.on(IPC.state, h);
    return () => ipcRenderer.off(IPC.state, h);
  },
  requestState(): void { ipcRenderer.send(IPC.requestState); },
  assignFolder(cwd: string, stationId: string): void { ipcRenderer.send(IPC.assignFolder, cwd, stationId); },
});

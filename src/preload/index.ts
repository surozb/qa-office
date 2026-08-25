import { contextBridge } from 'electron';
contextBridge.exposeInMainWorld('office', { version: '0.1.0' });

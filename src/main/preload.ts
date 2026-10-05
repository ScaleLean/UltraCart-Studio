import { contextBridge, ipcRenderer } from 'electron';
import type { StudioBridge, StudioEvent } from '../shared/types';
const bridge: StudioBridge = {
  invoke: (method, params) => ipcRenderer.invoke('studio:invoke', method, params),
  subscribe: (callback) => {
    const listener = (_event: unknown, event: StudioEvent) => callback(event);
    ipcRenderer.on('studio:event', listener);
    return () => ipcRenderer.removeListener('studio:event', listener);
  },
  previewBounds: (bounds) => ipcRenderer.send('studio:preview-bounds', bounds),
};
contextBridge.exposeInMainWorld('studio', bridge);

const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

contextBridge.exposeInMainWorld('electronAPI', {
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  selectFile: (options) => ipcRenderer.invoke('select-file', options),
  saveFile: (options) => ipcRenderer.invoke('save-file', options)
});

contextBridge.exposeInMainWorld('path', {
  basename: (p) => path.basename(p)
});

const { contextBridge, ipcRenderer } = require('electron');

const api = {
  getSnapshot: () => ipcRenderer.invoke('snapshot:get'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  exportSettings: () => ipcRenderer.invoke('settings:export'),
  importSettings: () => ipcRenderer.invoke('settings:import'),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  openRelease: (url) => ipcRenderer.send('update:open-release', url),
  scanBambu: () => ipcRenderer.invoke('bambu:scan'),
  scanMoonraker: () => ipcRenderer.invoke('moonraker:scan'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  openSettings: () => ipcRenderer.send('settings:open'),
  openPetMenu: () => ipcRenderer.send('pet:context-menu'),
  openPrinter: (id) => ipcRenderer.send('printer:open', id),
  openExtrusionTherapy: () => ipcRenderer.send('external:extrusion-therapy'),
  acknowledge: () => ipcRenderer.send('alert:acknowledge'),
  inspectStatus: () => ipcRenderer.send('status:inspect'),
  beginDrag: (point) => ipcRenderer.send('pet:drag-start', point),
  moveDrag: (point) => ipcRenderer.send('pet:drag-move', point),
  endDrag: () => ipcRenderer.send('pet:drag-end'),
  previewScale: (scale) => ipcRenderer.send('pet:preview-scale', scale),
  toggleBubble: () => ipcRenderer.send('bubble:toggle'),
  hideBubble: () => ipcRenderer.send('bubble:hide'),
  setBubbleHovered: (hovered) => ipcRenderer.send('bubble:hover', hovered),
  beginBubbleResize: () => ipcRenderer.send('bubble:resize-start'),
  moveBubbleResize: () => ipcRenderer.send('bubble:resize-move'),
  endBubbleResize: () => ipcRenderer.send('bubble:resize-end'),
  setPetHovered: (hovered) => ipcRenderer.send('pet:hover', hovered),
  onBubbleUpdate: (callback) => ipcRenderer.on('bubble:update', (_event, value) => callback(value)),
  onEasterEgg: (callback) => ipcRenderer.on('easter-egg', (_event, value) => callback(value)),
  onPrinterConnected: (callback) => ipcRenderer.on('printer:connected', (_event, value) => callback(value)),
  onPrinterConnectionStatus: (callback) => ipcRenderer.on('printer:connection-status', (_event, value) => callback(value)),
  onSnapshot: (callback) => ipcRenderer.on('snapshot', (_event, value) => callback(value)),
};

// These QA hooks have no matching handlers in packaged builds. They are kept
// out of the customer UI and only become active when main.js is run --dev.
api.simulateFleet = (printers) => ipcRenderer.send('status:simulate-fleet', printers);
api.simulateEasterEgg = (kind) => ipcRenderer.send('easter:simulate', kind);

contextBridge.exposeInMainWorld('spooly', api);

const path = require('path');
const fsSync = require('node:fs');
const fs = require('node:fs/promises');
const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, screen, shell, dialog, powerMonitor, net, Notification } = require('electron');
const Store = require('electron-store');
const { aggregatePrinters } = require('./state');
const { ADAPTER_REGISTRY, createAdapter, adapterMode } = require('./adapter-registry');
const { scanBambuPrinters } = require('./discovery/bambu');
const { scanMoonrakerPrinters } = require('./discovery/moonraker');
const { dedupePrinters, samePrinterConfiguration } = require('./printers');
const { formatAdapterError } = require('./adapter-errors');
const {
  clampBoundsToWorkArea,
  fixedSizeDragBounds,
  placementForBounds,
  resolveSavedBounds,
} = require('./window-placement');
const { fleetLayout, isNewAttention } = require('./bubble-policy');
const { clampScale, scaledSize, topRightResize } = require('./bubble-resize');
const { syncLaunchAtLogin } = require('./login-item');
const { migrateLegacyCredentials, preparePrintersForStorage } = require('./credentials');
const { compareVersions } = require('./update-check');
const { shouldNotifyForUpdate, shouldRunAutomaticUpdate } = require('./update-schedule');
const { printerStatusLabel } = require('./status-label');
const {
  nextPendingSetupPrinters,
  shouldReportSetupConnection,
  storeConnectionStatus,
} = require('./bambu-connection-status');

const RELEASES_API = 'https://api.github.com/repos/rdcstout/Spooly-by-Extrusion-Therapy/releases/latest';
const RELEASES_PAGE_PREFIX = 'https://github.com/rdcstout/Spooly-by-Extrusion-Therapy/releases/';

// Keep development builds, packaged betas, upgrades, and reinstalls on one
// stable configuration path. Removing Spooly.app does not remove this folder.
app.setPath('userData', process.env.SPOOLY_USER_DATA || path.join(app.getPath('appData'), 'spooly'));

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();

const store = new Store({
  defaults: { printers: [], scale: 1, bubbleScale: 1, onboarded: false, window: null, launchAtLogin: true, automaticUpdates: true, lastAutomaticUpdateCheck: 0, lastNotifiedUpdateVersion: '' },
});

function enforceStorePermissions() {
  try {
    fsSync.mkdirSync(path.dirname(store.path), { recursive: true, mode: 0o700 });
    if (fsSync.existsSync(store.path)) fsSync.chmodSync(store.path, 0o600);
  } catch (_) {}
}

const credentialMigration = migrateLegacyCredentials(store.get('printers'));
if (credentialMigration.changed) store.set('printers', credentialMigration.printers);
enforceStorePermissions();
let petWindow;
let settingsWindow;
let bubbleWindow;
let tray;
let pollTimer;
let adapters = [];
let printerStates = [];
let printerConnectionStatuses = new Map();
let pendingSetupPrinterIds = new Set();
let acknowledgedKey = null;
let simulatedPrinters = null;
let petDrag = null;
let petSizeLockTimer = null;
let bubbleHideTimer = null;
let bubbleHovered = false;
let petHovered = false;
let bubbleNaturalSize = null;
let bubbleResize = null;
let bubbleResizeTimer = null;
let bubbleResizePoint = null;
let automaticUpdateTimer = null;
const previewDevil = process.argv.includes('--dev') && process.argv.includes('--preview-devil');
const previewPaused = process.argv.includes('--dev') && process.argv.includes('--preview-paused');
const previewComplete = process.argv.includes('--dev') && process.argv.includes('--preview-complete');
const previewAll = process.argv.includes('--dev') && process.argv.includes('--preview-all');

if (process.argv.includes('--dev') && process.argv.includes('--preview-printing')) {
  simulatedPrinters = [{
    id: 'spooly-motion-preview',
    name: 'Motion preview',
    status: 'printing',
    progress: 42,
    message: 'Printing',
    online: true,
  }];
} else if (process.argv.includes('--dev') && process.argv.includes('--preview-idle')) {
  simulatedPrinters = [{
    id: 'spooly-motion-preview',
    name: 'Motion preview',
    status: 'idle',
    progress: 0,
    message: 'Idle',
    online: true,
  }];
} else if (process.argv.includes('--dev') && process.argv.includes('--preview-error')) {
  simulatedPrinters = [{
    id: 'spooly-motion-preview',
    name: 'Motion preview',
    status: 'error',
    progress: 42,
    message: 'Printer error',
    online: true,
  }];
} else if (process.argv.includes('--dev') && process.argv.includes('--preview-runout')) {
  simulatedPrinters = [{
    id: 'spooly-motion-preview',
    name: 'Motion preview',
    status: 'filament_out',
    progress: 42,
    message: 'Filament runout',
    online: true,
  }];
} else if (previewDevil) {
  simulatedPrinters = [{
    id: 'spooly-motion-preview',
    name: 'Motion preview',
    status: 'idle',
    progress: 0,
    message: 'Idle',
    online: true,
  }];
} else if (previewPaused) {
  simulatedPrinters = [{
    id: 'spooly-motion-preview',
    name: 'Motion preview',
    status: 'paused',
    progress: 42,
    message: 'Paused',
    online: true,
  }];
} else if (previewComplete) {
  simulatedPrinters = [{
    id: 'spooly-motion-preview',
    name: 'Motion preview',
    status: 'complete',
    progress: 100,
    message: 'Complete',
    online: true,
  }];
} else if (previewAll) {
  simulatedPrinters = [{
    id: 'spooly-motion-preview',
    name: 'Motion preview',
    status: 'offline',
    progress: 0,
    message: 'Offline',
    online: false,
  }];
}

function runtimePrinters() {
  return store.get('printers').map((printer) => ({ ...printer, accessCode: String(printer.accessCode || '') }));
}

function settingsPayload() {
  return {
    version: app.getVersion(),
    printers: runtimePrinters(),
    scale: store.get('scale'),
    launchAtLogin: store.get('launchAtLogin'),
    automaticUpdates: store.get('automaticUpdates'),
    connectionStatuses: [...printerConnectionStatuses.values()],
  };
}

async function fetchLatestRelease() {
  const response = await net.fetch(RELEASES_API, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!response.ok) throw new Error(`GitHub returned ${response.status}.`);
  const release = await response.json();
  const current = app.getVersion();
  const latest = String(release.tag_name || '').replace(/^v/i, '');
  const releaseUrl = String(release.html_url || '');
  return {
    current,
    latest,
    updateAvailable: compareVersions(latest, current) > 0,
    releaseUrl: releaseUrl.startsWith(RELEASES_PAGE_PREFIX) ? releaseUrl : `${RELEASES_PAGE_PREFIX}latest`,
  };
}

async function runAutomaticUpdateCheck() {
  if (!shouldRunAutomaticUpdate(store.get('automaticUpdates'), store.get('lastAutomaticUpdateCheck'))) return;
  store.set('lastAutomaticUpdateCheck', Date.now());
  try {
    const result = await fetchLatestRelease();
    if (!shouldNotifyForUpdate(store.get('automaticUpdates'), result, store.get('lastNotifiedUpdateVersion'))) return;
    store.set('lastNotifiedUpdateVersion', result.latest);
    if (!Notification.isSupported()) return;
    const notice = new Notification({
      title: 'Spooly update available',
      body: `Version ${result.latest} is ready to download.`,
    });
    notice.on('click', () => shell.openExternal(result.releaseUrl));
    notice.show();
  } catch (_) {}
}

function scheduleAutomaticUpdateChecks() {
  clearInterval(automaticUpdateTimer);
  automaticUpdateTimer = setInterval(runAutomaticUpdateCheck, 60 * 60 * 1000);
  setTimeout(runAutomaticUpdateCheck, 15000);
}

function snapshot() {
  const printers = simulatedPrinters || printerStates;
  const aggregate = aggregatePrinters(printers);
  const alertKey = aggregate.source && ['error', 'filament_out'].includes(aggregate.status)
    ? `${aggregate.source.id}:${aggregate.status}:${aggregate.source.message || ''}`
    : null;
  return {
    ...aggregate,
    bouncing: Boolean(alertKey && alertKey !== acknowledgedKey),
    onboarded: store.get('onboarded'),
  };
}

function broadcast() {
  const current = snapshot();
  if (!petWindow?.isDestroyed()) petWindow.webContents.send('snapshot', current);
  if (bubbleWindow?.isVisible()) updateBubble(current);
}

function positionBubble(current = snapshot()) {
  if (!bubbleWindow || bubbleWindow.isDestroyed() || !petWindow) return;
  if (bubbleResize) return;
  const petBounds = petWindow.getBounds();
  const workArea = screen.getDisplayMatching(petBounds).workArea;
  const layout = fleetLayout(current.printers.length);
  // Telemetry wraps by whole readings so every fan remains visible.
  const rowHeight = 94;
  const naturalHeight = Math.min(workArea.height - 12, Math.max(108, 42 + layout.rows * rowHeight));
  const numeric = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
  const telemetryLength = (printer) => {
    const showTargets = ['printing', 'paused'].includes(printer.status);
    const temperature = (label, currentValue, targetValue) => {
      if (!numeric(currentValue)) return null;
      const currentText = `${Math.round(Number(currentValue))}°`;
      const targetText = showTargets && numeric(targetValue) && Number(targetValue) > 0
        ? `/${Math.round(Number(targetValue))}°`
        : '';
      return `${label} ${currentText}${targetText}`;
    };
    return [
      temperature('NOZZLE', printer.nozzleTemp, printer.nozzleTarget),
      temperature('BED', printer.bedTemp, printer.bedTarget),
      ...(printer.fans || []).map((fan) => `${fan.label || 'FAN'} ${fan.on ? 'ON' : 'OFF'}`),
    ].filter(Boolean).join(' · ').length;
  };
  const contentLength = current.printers.length ? Math.max(...current.printers.flatMap((printer) => [
    String(printer.name || '').length + printerStatusLabel(printer).length + 2,
    telemetryLength(printer),
  ])) : 36;
  // Size for the complete telemetry line, including every reported fan. Only
  // screens too narrow for that width fall back to whole-token wrapping.
  const columnWidth = Math.min(540, Math.max(320, Math.ceil(contentLength * 6.45 + 68)));
  const naturalWidth = Math.min(workArea.width - 12, Math.max(172, layout.columns * columnWidth + (layout.columns - 1) * 15 + 32));
  bubbleNaturalSize = { width: naturalWidth, height: naturalHeight };
  const maximumScale = Math.max(0.65, Math.min(
    1.6,
    (workArea.width - 12) / naturalWidth,
    (workArea.height - 12) / naturalHeight,
  ));
  const bubbleScale = clampScale(store.get('bubbleScale'), 0.65, maximumScale);
  const { width, height } = scaledSize(bubbleNaturalSize, bubbleScale);
  const rightX = petBounds.x + Math.round(petBounds.width * 0.6);
  const fitsRight = rightX + width <= workArea.x + workArea.width;
  const leftX = petBounds.x - width + Math.round(petBounds.width * 0.4);
  const fitsLeft = leftX >= workArea.x;
  const side = fitsRight || (!fitsLeft && workArea.x + workArea.width - rightX >= petBounds.x - workArea.x) ? 'right' : 'left';
  const proposedX = side === 'right' ? rightX : leftX;
  const x = Math.max(workArea.x, Math.min(proposedX, workArea.x + workArea.width - width));
  const y = Math.max(workArea.y, Math.min(
    petBounds.y - height + 35,
    workArea.y + workArea.height - height,
  ));
  bubbleWindow.webContents.setZoomFactor(bubbleScale);
  bubbleWindow.setBounds({ x, y, width, height }, false);
  bubbleWindow.webContents.send('bubble:update', { snapshot: current, side, layout, bubbleScale });
}

function updateBubble(current = snapshot()) {
  if (!bubbleWindow || bubbleWindow.isDestroyed()) return;
  positionBubble(current);
}

function createBubbleWindow() {
  if (bubbleWindow && !bubbleWindow.isDestroyed()) return bubbleWindow;
  bubbleWindow = new BrowserWindow({
    width: 292, height: 160, transparent: true, frame: false, resizable: false,
    alwaysOnTop: true, skipTaskbar: true, hasShadow: false, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  bubbleWindow.setAlwaysOnTop(true, 'floating');
  bubbleWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  bubbleWindow.loadFile(path.join(__dirname, 'renderer', 'bubble.html'));
  bubbleWindow.on('closed', () => { bubbleWindow = null; });
  return bubbleWindow;
}

function toggleBubble() {
  const window = createBubbleWindow();
  if (window.isVisible()) { hideBubble(true); return; }
  showBubble();
}

function scheduleBubbleHide(delay = 1500) {
  clearTimeout(bubbleHideTimer);
  if (bubbleHovered || petHovered) return;
  bubbleHideTimer = setTimeout(() => hideBubble(), delay);
}

function showBubble(visibleFor = 7500) {
  const window = createBubbleWindow();
  const show = () => {
    positionBubble(snapshot());
    window.showInactive();
    scheduleBubbleHide(visibleFor);
  };
  if (window.webContents.isLoading()) window.webContents.once('did-finish-load', show);
  else show();
}

function hideBubble(force = false) {
  if (!force && (bubbleHovered || petHovered)) return;
  clearTimeout(bubbleHideTimer);
  bubbleHideTimer = null;
  bubbleWindow?.hide();
}

function createPetWindow() {
  const saved = store.get('window');
  const scale = store.get('scale');
  const size = Math.round(230 * scale);
  const initialBounds = saved
    ? resolveSavedBounds(saved, screen.getAllDisplays(), screen.getPrimaryDisplay(), size)
    : null;
  petWindow = new BrowserWindow({
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    maxWidth: size,
    maxHeight: size,
    x: initialBounds?.x,
    y: initialBounds?.y,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  petWindow.setAlwaysOnTop(true, 'floating');
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  petWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  if (previewDevil) {
    petWindow.webContents.once('did-finish-load', () => {
      const replay = () => petWindow?.webContents.send('easter-egg', 'bambu');
      setTimeout(replay, 500);
      setInterval(replay, 4000);
    });
  }
  if (previewComplete) {
    petWindow.webContents.once('did-finish-load', () => {
      const replay = () => petWindow?.webContents.send('easter-egg', 'complete-preview');
      setTimeout(replay, 4500);
      setInterval(replay, 5000);
    });
  }
  if (previewAll) {
    petWindow.webContents.once('did-finish-load', () => {
      const steps = [
        { status: 'offline', message: 'Offline', online: false, duration: 4500 },
        { status: 'idle', message: 'Idle', online: true, duration: 4500 },
        { status: 'idle', message: 'Hover preview', online: true, event: 'hover-preview', duration: 3000 },
        { status: 'printing', message: 'Printing', online: true, progress: 42, duration: 5000 },
        { status: 'paused', message: 'Paused', online: true, progress: 42, duration: 5000 },
        { status: 'error', message: 'Printer error', online: true, progress: 42, duration: 5000 },
        { status: 'filament_out', message: 'Filament runout', online: true, progress: 42, duration: 5000 },
        { status: 'complete', message: 'Complete', online: true, progress: 100, duration: 5000 },
        { status: 'idle', message: 'Bambu preview', online: true, event: 'bambu', duration: 4000 },
      ];
      let index = 0;
      const advance = () => {
        const step = steps[index];
        index = (index + 1) % steps.length;
        acknowledgedKey = null;
        simulatedPrinters = [{
          id: 'spooly-motion-preview',
          name: 'Motion preview',
          status: step.status,
          progress: step.progress || 0,
          message: step.message,
          online: step.online,
        }];
        broadcast();
        if (step.event) setTimeout(() => petWindow?.webContents.send('easter-egg', step.event), 250);
        setTimeout(advance, step.duration);
      };
      setTimeout(advance, 500);
    });
  }
  petWindow.on('moved', () => {
    enforcePetWindowSize();
    if (bubbleWindow?.isVisible()) positionBubble();
  });
  petWindow.on('close', (event) => {
    if (!app.isQuitting) { event.preventDefault(); petWindow.hide(); }
  });
}

function expectedPetSize() {
  return Math.round(230 * Math.max(0.65, Math.min(1.1, Number(store.get('scale')) || 1)));
}

function enforcePetWindowSize() {
  if (!petWindow || petWindow.isDestroyed()) return;
  const expected = expectedPetSize();
  const bounds = petWindow.getBounds();
  if (bounds.width !== expected || bounds.height !== expected) {
    petWindow.setBounds({ ...bounds, width: expected, height: expected }, false);
  }
  petWindow.setMinimumSize(expected, expected);
  petWindow.setMaximumSize(expected, expected);
}

function schedulePetWindowSizeLock() {
  enforcePetWindowSize();
  clearTimeout(petSizeLockTimer);
  // Windows applies per-monitor DPI changes asynchronously. Re-lock after the
  // move settles so a 125% display cannot add pixels after our drag IPC ends.
  petSizeLockTimer = setTimeout(enforcePetWindowSize, 150);
}

function persistPetPlacement() {
  if (!petWindow || petWindow.isDestroyed()) return;
  const bounds = petWindow.getBounds();
  store.set('window', placementForBounds(bounds, screen.getDisplayMatching(bounds)));
}

function restorePetPlacement() {
  if (!petWindow || petWindow.isDestroyed()) return;
  const saved = store.get('window');
  if (!saved) return;
  const bounds = resolveSavedBounds(
    saved,
    screen.getAllDisplays(),
    screen.getPrimaryDisplay(),
    petWindow.getBounds().width,
  );
  petWindow.setBounds(bounds, false);
  if (bubbleWindow?.isVisible()) positionBubble();
}

function resizePet(scale) {
  if (!petWindow || petWindow.isDestroyed()) return;
  const nextSize = Math.round(230 * Math.max(0.65, Math.min(1.1, Number(scale) || 1)));
  const bounds = petWindow.getBounds();
  const proposed = {
    x: Math.round(bounds.x + (bounds.width - nextSize) / 2),
    y: bounds.y + bounds.height - nextSize,
    width: nextSize,
    height: nextSize,
  };
  const display = screen.getDisplayMatching(proposed);
  petWindow.setBounds(clampBoundsToWorkArea(proposed, display.workArea), false);
  enforcePetWindowSize();
  persistPetPlacement();
  if (bubbleWindow?.isVisible()) positionBubble();
}

function openSettings() {
  if (settingsWindow) return settingsWindow.focus();
  settingsWindow = new BrowserWindow({
    width: 560, height: 760, title: 'Spooly Setup', resizable: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  settingsWindow.setMenuBarVisibility(false);
  settingsWindow.loadFile(path.join(__dirname, 'renderer', 'settings.html'));
  settingsWindow.on('closed', () => { settingsWindow = null; resizePet(store.get('scale')); });
}

function createTray() {
  const trayImage = nativeImage
    .createFromPath(path.join(__dirname, '..', 'assets', 'trayTemplate.png'))
    .resize({ width: 18, height: 18 });
  trayImage.setTemplateImage(true);
  tray = new Tray(trayImage);
  tray.setToolTip('Spooly');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show Spooly', click: () => petWindow.show() },
    { label: 'Setup…', click: openSettings },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } },
  ]));
  tray.on('click', () => petWindow.show());
}

function stopAdapters() {
  clearInterval(pollTimer);
  adapters.forEach((adapter) => adapter.disconnect?.());
  adapters = [];
}

async function configureAdapters(setupPrinterIds = new Set(), { preserveUnchanged = false } = {}) {
  clearInterval(pollTimer);
  const configs = runtimePrinters();
  const previousStates = new Map(printerStates.map((state) => [state.id, state]));
  const previousAdapters = adapters;
  const preservedAdapters = new Map();
  const adaptersToDisconnect = [];
  if (preserveUnchanged) {
    previousAdapters.forEach((adapter) => {
      const config = configs.find((candidate) => candidate.id === adapter.config.id);
      if (config && samePrinterConfiguration(config, adapter.config)) preservedAdapters.set(config.id, adapter);
      else adaptersToDisconnect.push(adapter);
    });
  } else {
    adaptersToDisconnect.push(...previousAdapters);
  }
  printerConnectionStatuses = new Map();
  printerStates = configs.map((config) => preservedAdapters.has(config.id) && previousStates.has(config.id)
    ? previousStates.get(config.id)
    : { id: config.id, name: config.name, type: config.type, status: 'offline', message: '' });
  const setState = (state) => {
    const index = printerStates.findIndex((p) => p.id === state.id);
    const previous = index >= 0 ? printerStates[index] : null;
    if (index >= 0) printerStates[index] = state; else printerStates.push(state);
    const aggregate = aggregatePrinters(printerStates);
    if (!['error', 'filament_out'].includes(aggregate.status)) acknowledgedKey = null;
    broadcast();
    if (isNewAttention(previous, state)) showBubble(8000);
  };
  const connectedIds = new Set();
  const reportConnectionStatus = (value) => {
    storeConnectionStatus(printerConnectionStatuses, value);
    settingsWindow?.webContents.send('printer:connection-status', value);
  };
  const markConnected = (config) => {
    if (connectedIds.has(config.id)) return;
    connectedIds.add(config.id);
    if (setupPrinterIds.has(config.id)) {
      settingsWindow?.webContents.send('printer:connected', { id: config.id, name: config.name, type: config.type });
      pendingSetupPrinterIds.delete(config.id);
    }
    if (setupPrinterIds.has(config.id) && config.type === 'bambu') {
      petWindow?.webContents.send('easter-egg', 'bambu');
    }
  };
  adapters = configs.map((config) => preservedAdapters.get(config.id) || createAdapter(config));
  adaptersToDisconnect.forEach((adapter) => adapter.disconnect?.());
  adapters.filter((adapter) => adapterMode(adapter.config) === 'push' && !preservedAdapters.has(adapter.config.id))
    .forEach((adapter) => adapter.connect(
      (state) => { if (adapters.includes(adapter)) setState(state); },
      (config) => { if (adapters.includes(adapter)) markConnected(config); },
      shouldReportSetupConnection(setupPrinterIds, adapter.config.id)
        ? (value) => { if (adapters.includes(adapter)) reportConnectionStatus(value); }
        : () => {},
    ));
  const pollAdapters = async () => {
    await Promise.all(adapters.filter((a) => adapterMode(a.config) === 'poll').map(async (adapter) => {
      try {
        const state = await adapter.read();
        if (adapters.includes(adapter)) { setState(state); markConnected(adapter.config); }
      } catch (error) {
        if (adapters.includes(adapter)) setState({ id: adapter.config.id, name: adapter.config.name, type: adapter.config.type, status: 'offline', message: formatAdapterError(error) });
      }
    }));
  };
  await pollAdapters();
  pollTimer = setInterval(pollAdapters, 3000);
  broadcast();
}

app.whenReady().then(async () => {
  syncLaunchAtLogin(app, store.get('launchAtLogin'));
  createPetWindow();
  createTray();
  await configureAdapters();
  scheduleAutomaticUpdateChecks();
  if (!store.get('onboarded')) petWindow.webContents.once('did-finish-load', broadcast);
  powerMonitor.on('resume', () => {
    setTimeout(restorePetPlacement, 500);
    setTimeout(restorePetPlacement, 2200);
  });
  screen.on('display-added', () => setTimeout(restorePetPlacement, 500));
  screen.on('display-metrics-changed', () => setTimeout(restorePetPlacement, 500));
});

app.on('second-instance', () => {
  if (!petWindow || petWindow.isDestroyed()) return;
  if (!petWindow.isVisible()) petWindow.show();
  petWindow.focus();
});

app.on('window-all-closed', () => {});
app.on('activate', () => petWindow?.show());
app.on('before-quit', () => { app.isQuitting = true; stopAdapters(); clearInterval(automaticUpdateTimer); });

ipcMain.handle('snapshot:get', () => snapshot());
ipcMain.handle('bambu:scan', () => scanBambuPrinters());
ipcMain.handle('moonraker:scan', () => scanMoonrakerPrinters());
ipcMain.handle('repetierserver:list-printers', (_event, config) => createAdapter({
  type: 'repetierserver',
  host: config?.host,
  port: config?.port,
  apiKey: config?.apiKey,
}).listPrinters());
ipcMain.handle('settings:get', settingsPayload);
ipcMain.handle('settings:export', async () => {
  const result = await dialog.showSaveDialog(settingsWindow, {
    title: 'Export Spooly configuration',
    defaultPath: 'Spooly Configuration Backup.json',
    filters: [{ name: 'Spooly configuration', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePath) return { ok: false };
  const backup = {
    format: 'spooly-configuration',
    version: 1,
    exportedAt: new Date().toISOString(),
    printers: store.get('printers'),
    scale: store.get('scale'),
    launchAtLogin: store.get('launchAtLogin'),
    automaticUpdates: store.get('automaticUpdates'),
  };
  await fs.writeFile(result.filePath, `${JSON.stringify(backup, null, 2)}\n`, { mode: 0o600 });
  await fs.chmod(result.filePath, 0o600);
  return { ok: true };
});
ipcMain.handle('settings:import', async () => {
  const result = await dialog.showOpenDialog(settingsWindow, {
    title: 'Restore Spooly configuration',
    properties: ['openFile'],
    filters: [{ name: 'Spooly configuration', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePaths[0]) return { ok: false };
  const backup = JSON.parse(await fs.readFile(result.filePaths[0], 'utf8'));
  if (backup?.format !== 'spooly-configuration' || backup.version !== 1 || !Array.isArray(backup.printers)) {
    throw new Error('This is not a valid Spooly configuration backup.');
  }
  const validPrinters = dedupePrinters(backup.printers.filter((printer) =>
    printer && typeof printer.id === 'string' && typeof printer.name === 'string'
      && typeof printer.host === 'string' && Object.keys(ADAPTER_REGISTRY).includes(printer.type)
  ));
  const printers = migrateLegacyCredentials(validPrinters).printers;
  store.set('printers', printers);
  store.set('scale', Math.max(.65, Math.min(1.1, Number(backup.scale) || 1)));
  store.set('launchAtLogin', backup.launchAtLogin !== false);
  store.set('automaticUpdates', backup.automaticUpdates !== false);
  store.set('onboarded', printers.length > 0);
  pendingSetupPrinterIds = new Set();
  enforceStorePermissions();
  syncLaunchAtLogin(app, store.get('launchAtLogin'));
  resizePet(store.get('scale'));
  await configureAdapters();
  return { ok: true, settings: settingsPayload() };
});
ipcMain.handle('settings:save', async (_event, settings) => {
  const printers = dedupePrinters(settings.printers);
  const existingIds = new Set(store.get('printers').map((printer) => printer.id));
  const nextIds = new Set(printers.map((printer) => printer.id));
  pendingSetupPrinterIds = nextPendingSetupPrinters(pendingSetupPrinterIds, existingIds, nextIds);
  const setupPrinterIds = new Set(pendingSetupPrinterIds);
  store.set('printers', preparePrintersForStorage(printers));
  store.set('scale', settings.scale);
  store.set('launchAtLogin', settings.launchAtLogin);
  store.set('automaticUpdates', settings.automaticUpdates !== false);
  store.set('onboarded', printers.length > 0);
  enforceStorePermissions();
  syncLaunchAtLogin(app, settings.launchAtLogin);
  resizePet(settings.scale);
  await configureAdapters(setupPrinterIds, { preserveUnchanged: true });
  return true;
});
ipcMain.handle('update:check', async () => {
  return fetchLatestRelease();
});
ipcMain.on('update:open-release', (_event, url) => {
  const releaseUrl = String(url || '');
  if (releaseUrl.startsWith(RELEASES_PAGE_PREFIX)) shell.openExternal(releaseUrl);
});
ipcMain.on('settings:open', openSettings);
ipcMain.on('external:extrusion-therapy', () => shell.openExternal('https://extrusiontherapy.com'));
ipcMain.on('bubble:toggle', toggleBubble);
ipcMain.on('bubble:hide', () => hideBubble(true));
ipcMain.on('bubble:hover', (_event, hovered) => {
  bubbleHovered = Boolean(hovered);
  if (bubbleHovered) clearTimeout(bubbleHideTimer);
  else scheduleBubbleHide();
});
ipcMain.on('bubble:resize-start', () => {
  if (!bubbleWindow || bubbleWindow.isDestroyed() || !bubbleNaturalSize) return;
  bubbleHovered = true;
  clearTimeout(bubbleHideTimer);
  const bounds = bubbleWindow.getBounds();
  const workArea = screen.getDisplayMatching(bounds).workArea;
  bubbleResize = {
    cursor: screen.getCursorScreenPoint(),
    bounds,
    baseSize: { ...bubbleNaturalSize },
    maximumScale: Math.max(0.65, Math.min(
      1.6,
      (workArea.width - 12) / bubbleNaturalSize.width,
      (workArea.height - 12) / bubbleNaturalSize.height,
    )),
    scale: clampScale(store.get('bubbleScale')),
  };
  bubbleResizePoint = bubbleResize.cursor;
});
function applyBubbleResize() {
  bubbleResizeTimer = null;
  if (!bubbleResize || !bubbleWindow || bubbleWindow.isDestroyed()) return;
  const result = topRightResize({
    startCursor: bubbleResize.cursor,
    startBounds: bubbleResize.bounds,
    point: bubbleResizePoint || screen.getCursorScreenPoint(),
    baseSize: bubbleResize.baseSize,
    maximum: bubbleResize.maximumScale,
  });
  bubbleResize.scale = result.scale;
  bubbleWindow.setBounds(result.bounds, false);
  bubbleWindow.webContents.setZoomFactor(result.scale);
}
ipcMain.on('bubble:resize-move', () => {
  if (!bubbleResize || !bubbleWindow || bubbleWindow.isDestroyed()) return;
  bubbleResizePoint = screen.getCursorScreenPoint();
  if (!bubbleResizeTimer) bubbleResizeTimer = setTimeout(applyBubbleResize, 16);
});
ipcMain.on('bubble:resize-end', () => {
  if (!bubbleResize) return;
  bubbleResizePoint = screen.getCursorScreenPoint();
  clearTimeout(bubbleResizeTimer);
  applyBubbleResize();
  store.set('bubbleScale', bubbleResize.scale);
  bubbleResize = null;
  bubbleResizePoint = null;
  bubbleHovered = false;
  positionBubble(snapshot());
  scheduleBubbleHide();
});
ipcMain.on('pet:hover', (_event, hovered) => {
  petHovered = Boolean(hovered);
  if (petHovered) clearTimeout(bubbleHideTimer);
  else scheduleBubbleHide();
});
ipcMain.on('pet:preview-scale', (_event, scale) => {
  const persistedScale = Math.max(.65, Math.min(1.1, Number(scale) || 1));
  store.set('scale', persistedScale);
  resizePet(persistedScale);
});
ipcMain.on('pet:drag-start', () => {
  if (!petWindow) return;
  petDrag = { cursor: screen.getCursorScreenPoint(), bounds: petWindow.getBounds() };
});
ipcMain.on('pet:drag-move', () => {
  if (!petDrag || !petWindow || petWindow.isDestroyed()) return;
  const point = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint({ x: Math.round(point.x), y: Math.round(point.y) });
  const fixedBounds = fixedSizeDragBounds(
    petDrag.bounds,
    petDrag.cursor,
    point,
    display.workArea,
    expectedPetSize(),
  );
  // One atomic bounds update avoids Electron's Windows mixed-DPI setPosition
  // path, which can grow a frameless window by a few pixels per movement.
  petWindow.setBounds(fixedBounds, false);
  schedulePetWindowSizeLock();
});
ipcMain.on('pet:drag-end', () => {
  petDrag = null;
  schedulePetWindowSizeLock();
  persistPetPlacement();
});
ipcMain.on('alert:acknowledge', () => {
  const current = snapshot();
  if (current.source) acknowledgedKey = `${current.source.id}:${current.status}:${current.source.message || ''}`;
  broadcast();
});
ipcMain.on('status:inspect', () => {
  const current = snapshot();
  if (current.source && ['error', 'filament_out'].includes(current.status)) {
    acknowledgedKey = `${current.source.id}:${current.status}:${current.source.message || ''}`;
  }
  // Inspection is never a dismissal action. Error notifications can already
  // have the bubble open automatically; clicking Spooly should stop the alert
  // motion and refresh the readable status, not toggle that bubble away.
  showBubble(7500);
  broadcast();
});
if (process.argv.includes('--dev')) {
  ipcMain.on('status:simulate-fleet', (_event, printers) => {
    simulatedPrinters = Array.isArray(printers) ? printers : null;
    acknowledgedKey = null;
    broadcast();
    if (bubbleWindow?.isVisible()) positionBubble();
  });
  ipcMain.on('easter:simulate', (_event, kind) => petWindow?.webContents.send('easter-egg', kind));
}

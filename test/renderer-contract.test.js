const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

test('preserves the mascot focus-ring suppression', () => {
  assert.match(source('src/renderer/pet.css'), /\.pet:focus\s*\{\s*outline:\s*none;/);
});

test('keeps the mascot native window backing transparent', () => {
  const main = source('src/main.js');
  assert.match(main, /transparent:\s*true,\s*backgroundColor:\s*'#00000000'/);
});

test('colors each printer status and telemetry category independently', () => {
  const script = source('src/renderer/bubble.js');
  const styles = source('src/renderer/bubble.css');
  assert.match(script, /statusKind/);
  assert.match(script, /class="nozzle"/);
  assert.match(script, /class="bed"/);
  assert.match(script, /class="fans"/);
  assert.match(styles, /\.status\.printing, \.status\.complete/);
  assert.match(styles, /\.status\.paused/);
  assert.match(styles, /\.status\.error, \.status\.filament_out, \.status\.stopped/);
  assert.match(styles, /\.telemetry \.nozzle/);
  assert.match(styles, /\.telemetry \.bed/);
  assert.match(styles, /\.telemetry \.fans/);
  assert.match(styles, /\.telemetry \{[^}]*font-size:\s*10px/);
});

test('wraps complete telemetry readings instead of truncating fan values', () => {
  const script = source('src/renderer/bubble.js');
  const main = source('src/main.js');
  const styles = source('src/renderer/bubble.css');
  assert.match(script, /\.\.\.fans\.map\(\(fan\) => `<span class="fans">/);
  assert.match(main, /telemetryLength\(printer\)/);
  assert.match(main, /\.\.\.\(printer\.fans \|\| \[\]\)\.map/);
  assert.match(styles, /\.telemetry \{[^}]*flex-wrap:\s*wrap/);
  assert.match(styles, /\.telemetry > span \{[^}]*white-space:\s*nowrap/);
  assert.doesNotMatch(styles, /\.telemetry \{[^}]*text-overflow:\s*ellipsis/);
});

test('omits missing numeric telemetry instead of converting it to zero', () => {
  const script = source('src/renderer/bubble.js');
  assert.match(script, /value !== null && value !== undefined && value !== ''/);
  assert.match(script, /!hasNumericValue\(printer\.progress\)/);
  assert.match(script, /!hasNumericValue\(current\)/);
});

test('shows temperature targets only while printing or paused', () => {
  const script = source('src/renderer/bubble.js');
  assert.match(script, /const showTargets = \['printing', 'paused'\]\.includes\(printer\.status\)/);
  assert.match(script, /temperature\(printer\.nozzleTemp, showTargets \? printer\.nozzleTarget : null\)/);
  assert.match(script, /temperature\(printer\.bedTemp, showTargets \? printer\.bedTarget : null\)/);
});

test('shows the packaged version and prepends user-added printer cards', () => {
  const main = source('src/main.js');
  const settings = source('src/renderer/settings.js');
  assert.match(main, /version: app\.getVersion\(\)/);
  assert.match(settings, /Version \$\{settings\.version\}/);
  assert.match(settings, /prepend: true, focus: true/);
  assert.match(settings, /if \(prepend\) list\.prepend\(card\)/);
});

test('dragging cancels hover scaling and hard-locks the pet window size', () => {
  const pet = source('src/renderer/pet.js');
  const main = source('src/main.js');
  assert.match(pet, /pet\.addEventListener\('pointerdown',[\s\S]*?stopHoverReaction\(\)/);
  assert.match(pet, /if \(dragging \|\| !\['idle', 'complete'\]/);
  assert.match(main, /function enforcePetWindowSize\(\)/);
  assert.match(main, /petWindow\.setMinimumSize\(expected, expected\)/);
  assert.match(main, /petWindow\.setMaximumSize\(expected, expected\)/);
  assert.match(main, /screen\.getCursorScreenPoint\(\)/);
  assert.match(main, /petWindow\.setBounds\(fixedBounds, false\);\s*schedulePetWindowSizeLock\(\)/);
  assert.doesNotMatch(main, /petWindow\.setPosition\(clamped\.x, clamped\.y, false\)/);
});

test('printer popup exposes proportional resizing and closes 1.5 seconds after mouse-away', () => {
  const main = source('src/main.js');
  const preload = source('src/preload.js');
  const bubble = source('src/renderer/bubble.js');
  assert.match(main, /function scheduleBubbleHide\(delay = 1500\)/);
  assert.match(main, /ipcMain\.on\('bubble:resize-start'/);
  assert.match(main, /ipcMain\.on\('bubble:resize-move'/);
  assert.match(main, /ipcMain\.on\('bubble:resize-end'/);
  assert.match(preload, /beginBubbleResize/);
  assert.match(bubble, /resizeHandle\.addEventListener\('pointerdown'/);
});

test('setup exposes weekly and manual GitHub update checks', () => {
  const main = source('src/main.js');
  const preload = source('src/preload.js');
  const html = source('src/renderer/settings.html');
  const settings = source('src/renderer/settings.js');
  assert.match(main, /ipcMain\.handle\('update:check'/);
  assert.match(preload, /checkForUpdates/);
  assert.match(html, /id="checkUpdates"/);
  assert.match(html, /id="automaticUpdates"/);
  assert.match(html, /once a week/);
  assert.match(settings, /#checkUpdates/);
  assert.match(main, /scheduleAutomaticUpdateChecks/);
  assert.match(main, /lastAutomaticUpdateCheck/);
  assert.match(main, /lastNotifiedUpdateVersion/);
  assert.match(main, /automaticUpdates: store\.get\('automaticUpdates'\)/);
  assert.match(settings, /automaticUpdates\.checked = result\.settings\.automaticUpdates !== false/);
});

test('bubble shows only printer-reported remaining time', () => {
  const script = source('src/renderer/bubble.js');
  const bambu = source('src/adapters/bambu.js');
  const html = source('src/renderer/bubble.html');
  const main = source('src/main.js');
  assert.match(bambu, /remainingMinutes: numeric\(print\.mc_remaining_time\)/);
  assert.match(html, /\.\.\/status-label\.js/);
  assert.match(script, /printerStatusLabel\(printer\)/);
  assert.match(main, /printerStatusLabel\(printer\)\.length/);
  assert.doesNotMatch(source('src/adapters/moonraker.js'), /remainingMinutes/);
});

test('duplicate scan results stay in the current printer card', () => {
  const settings = source('src/renderer/settings.js');
  const duplicateBody = settings.match(/function revealDuplicate[\s\S]*?\n\}/)?.[0] || '';
  assert.match(duplicateBody, /No new printer selected/);
  assert.doesNotMatch(duplicateBody, /scrollIntoView/);
});

test('setup presents persistent staged Bambu connection failures', () => {
  const main = source('src/main.js');
  const preload = source('src/preload.js');
  const html = source('src/renderer/settings.html');
  const settings = source('src/renderer/settings.js');
  const bambu = source('src/adapters/bambu.js');
  assert.match(main, /printerConnectionStatuses/);
  assert.match(main, /storeConnectionStatus/);
  assert.match(main, /shouldReportSetupConnection\(setupPrinterIds, adapter\.config\.id\)/);
  assert.match(main, /if \(setupPrinterIds\.has\(config\.id\)\)/);
  assert.match(main, /nextPendingSetupPrinters/);
  assert.match(main, /samePrinterConfiguration\(config, adapter\.config\)/);
  assert.match(main, /preserveUnchanged: true/);
  assert.match(main, /printer:connection-status/);
  assert.match(preload, /onPrinterConnectionStatus/);
  assert.match(html, /class="bambu connection-status" role="status" aria-live="polite"/);
  assert.match(settings, /function showConnectionStatus/);
  assert.match(settings, /value\.phase === 'connected'/);
  assert.match(settings, /const existingPrinterIds = new Set\(\)/);
  assert.match(settings, /newPrinterCount > 0/);
  assert.match(settings, /: 'Saved\.'/);
  assert.match(settings, /BAMBU-DISCOVERY-01/);
  assert.match(bambu, /classifyConnectionError/);
  assert.match(bambu, /status\('noTelemetry'\)/);
  assert.match(bambu, /status\('malformedTelemetry'\)/);
});

test('DMG icons fit inside the configured installer window', () => {
  const packageJson = require('../package.json');
  assert.deepEqual(packageJson.build.dmg.contents, [
    { x: 130, y: 180 },
    { x: 410, y: 180, type: 'link', path: '/Applications' },
  ]);
});

test('bubble offers a close button, clickable printer names, and the pet a hide context menu', () => {
  const main = source('src/main.js');
  const preload = source('src/preload.js');
  const html = source('src/renderer/bubble.html');
  const bubble = source('src/renderer/bubble.js');
  const styles = source('src/renderer/bubble.css');
  const pet = source('src/renderer/pet.js');
  assert.match(html, /id="closeBubble"/);
  assert.match(styles, /\.close-bubble \{[^}]*color:\s*#657174/);
  assert.match(bubble, /closeBubble\.addEventListener\('click', \(\) => window\.spooly\.hideBubble\(\)\)/);
  assert.match(bubble, /<button class="name" type="button" data-id="\$\{escapeHtml\(printer\.id\)\}"/);
  assert.match(bubble, /window\.spooly\.openPrinter\(/);
  assert.match(preload, /openPrinter: \(id\) => ipcRenderer\.send\('printer:open', id\)/);
  assert.match(main, /ipcMain\.on\('printer:open'/);
  assert.match(main, /printerWebUrl\(/);
  assert.match(main, /bambuStudioCandidates\(/);
  assert.match(pet, /pet\.addEventListener\('contextmenu', \(event\) => \{ event\.preventDefault\(\); window\.spooly\.openPetMenu\(\); \}\)/);
  assert.match(preload, /openPetMenu: \(\) => ipcRenderer\.send\('pet:context-menu'\)/);
  assert.match(main, /ipcMain\.on\('pet:context-menu'/);
  assert.match(main, /label: 'Hide Spooly', click: hidePet/);
  assert.doesNotMatch(main, /store\.set\('petHidden'/);
  assert.match(main, /tray\.on\('click', togglePet\)/);
  assert.match(main, /function togglePet\(\) \{[^}]*isVisible\(\) \? hidePet\(\) : petWindow\.show\(\)/);
});

const bubble = document.querySelector('#bubble');
const resizeHandle = document.querySelector('#resizeHandle');
const { printerStatusLabel } = globalThis.SpoolyStatusLabel;
let resizing = false;

function escapeHtml(value = '') {
  const node = document.createElement('span');
  node.textContent = value;
  return node.innerHTML;
}

function hasNumericValue(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

function temperature(current, target) {
  if (!hasNumericValue(current)) return null;
  const rounded = Math.round(Number(current));
  return hasNumericValue(target) && Number(target) > 0
    ? `${rounded}°/${Math.round(Number(target))}°`
    : `${rounded}°`;
}

function fanStatuses(fans = []) {
  return fans.map((fan) => `${fan.label || 'FAN'} ${fan.on ? 'ON' : 'OFF'}`);
}

function progressBar(printer) {
  const problem = ['error', 'filament_out'].includes(printer.status);
  if (!problem && !['printing', 'paused', 'complete'].includes(printer.status)) return '';
  if (['printing', 'paused'].includes(printer.status) && !hasNumericValue(printer.progress)) return '';
  const value = problem || printer.status === 'complete'
    ? 100
    : Math.max(0, Math.min(100, Number(printer.progress) || 0));
  const kind = problem ? 'problem' : printer.status;
  return `<span class="progress ${kind}" aria-hidden="true"><i style="width:${value}%"></i></span>`;
}

window.spooly.onBubbleUpdate(({ snapshot, side, layout }) => {
  document.body.className = side;
  bubble.style.setProperty('--columns', layout.columns);
  bubble.style.setProperty('--rows', layout.rows);
  if (!snapshot.printers.length) {
    bubble.innerHTML = '<strong>Time for some extrusion therapy?</strong><br>Let’s add your first printer.';
    return;
  }
  bubble.innerHTML = snapshot.printers.map((printer) => {
    // Keep idle telemetry clean and consistent. During an active or paused job,
    // show measured/target temperatures for every printer that supplies them.
    const showTargets = ['printing', 'paused'].includes(printer.status);
    const nozzle = temperature(printer.nozzleTemp, showTargets ? printer.nozzleTarget : null);
    const bed = temperature(printer.bedTemp, showTargets ? printer.bedTarget : null);
    const fans = fanStatuses(printer.fans);
    const telemetryItems = [
      nozzle && `<span class="nozzle">NOZZLE ${escapeHtml(nozzle)}</span>`,
      bed && `<span class="bed">BED ${escapeHtml(bed)}</span>`,
      ...fans.map((fan) => `<span class="fans">${escapeHtml(fan)}</span>`),
    ].filter(Boolean);
    const telemetry = telemetryItems.length
      ? `<span class="telemetry">${telemetryItems.join('')}</span>`
      : '';
    const statusKind = printer.attention?.type === 'stopped' ? 'stopped' : printer.status;
    const statusText = snapshot.networkHelp
      ? '<button class="network-help" type="button" title="Can’t connect? Open network help" aria-label="Offline — open network connection help">OFFLINE ⓘ</button>'
      : escapeHtml(printerStatusLabel(printer));
    return `<div class="row"><strong>${escapeHtml(printer.name)}</strong><span class="status ${escapeHtml(statusKind)}">${statusText}</span>
      ${(printer.message || printer.attention?.message) ? `<span class="message">${escapeHtml(printer.message || printer.attention.message)}</span>` : ''}${progressBar(printer)}${telemetry}</div>`;
  }).join('');
});

bubble.addEventListener('click', (event) => {
  if (event.target.closest('.network-help')) window.spooly.openNetworkHelp();
});

bubble.addEventListener('mouseenter', () => window.spooly.setBubbleHovered(true));
bubble.addEventListener('mouseleave', () => window.spooly.setBubbleHovered(false));

resizeHandle.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  resizing = true;
  resizeHandle.setPointerCapture(event.pointerId);
  window.spooly.beginBubbleResize();
  event.preventDefault();
});

resizeHandle.addEventListener('pointermove', (event) => {
  if (!resizing) return;
  window.spooly.moveBubbleResize();
  event.preventDefault();
});

function finishResize(event) {
  if (!resizing) return;
  resizing = false;
  if (resizeHandle.hasPointerCapture(event.pointerId)) resizeHandle.releasePointerCapture(event.pointerId);
  window.spooly.endBubbleResize();
  event.preventDefault();
}

resizeHandle.addEventListener('pointerup', finishResize);
resizeHandle.addEventListener('pointercancel', finishResize);

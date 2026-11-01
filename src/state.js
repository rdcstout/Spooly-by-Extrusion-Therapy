const PRIORITY = {
  error: 60,
  filament_out: 50,
  paused: 40,
  complete: 35,
  printing: 30,
  idle: 10,
  offline: 0,
};

function normalizeStatus(status) {
  return Object.hasOwn(PRIORITY, status) ? status : 'offline';
}

function aggregatePrinters(printers = []) {
  const normalized = printers.map((printer) => ({
    ...printer,
    status: normalizeStatus(printer.status),
  }));
  const online = normalized.filter((printer) => printer.status !== 'offline');
  if (!online.length) {
    return { status: 'offline', source: null, printers: normalized };
  }
  const source = online.reduce((winner, printer) =>
    PRIORITY[printer.status] > PRIORITY[winner.status] ? printer : winner
  );
  return { status: source.status, source, printers: normalized };
}

// A finished printer remains COMPLETE in telemetry, but after its celebration
// is acknowledged it must not hide another printer's ongoing activity.
function completionFallbackStatus(printers = []) {
  return aggregatePrinters(printers.map((printer) => printer.status === 'complete'
    ? { ...printer, status: 'idle' }
    : printer)).status;
}

module.exports = { PRIORITY, aggregatePrinters, normalizeStatus, completionFallbackStatus };

// Keep reported status intact. Celebrate only jobs observed in progress.
function observeCompletion(previous, printer) {
  const armed = previous === true;
  if (['printing', 'paused'].includes(printer.status)) return { armed: true, celebrate: false };
  if (printer.status === 'complete') return { armed: false, celebrate: armed };
  if (printer.status === 'idle') return { armed: false, celebrate: false };
  // An outage or attention state does not erase a job in progress.
  return { armed, celebrate: false };
}

module.exports = { observeCompletion };

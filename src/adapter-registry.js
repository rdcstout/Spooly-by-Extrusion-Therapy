const { MoonrakerAdapter } = require('./adapters/moonraker');
const { BambuAdapter } = require('./adapters/bambu');
const { DuetAdapter } = require('./adapters/duet');
const { RepetierServerAdapter } = require('./adapters/repetierserver');

// Single lookup point mapping a printer's `type` to its adapter class and
// connection mode. Push adapters (e.g. MQTT) connect once and stream state;
// poll adapters (e.g. HTTP) are read on an interval. Add a new printer type
// by adding one entry here — no branching logic elsewhere should need to
// change.
const ADAPTER_REGISTRY = {
  moonraker: { AdapterClass: MoonrakerAdapter, mode: 'poll' },
  bambu: { AdapterClass: BambuAdapter, mode: 'push' },
  repetierserver: { AdapterClass: RepetierServerAdapter, mode: 'poll' },
  duet: { AdapterClass: DuetAdapter, mode: 'poll' },
};

function createAdapter(config) {
  const entry = ADAPTER_REGISTRY[config.type];
  if (!entry) throw new Error(`Unknown printer type: ${config.type}`);
  return new entry.AdapterClass(config);
}

function adapterMode(config) {
  return ADAPTER_REGISTRY[config.type]?.mode;
}

module.exports = { ADAPTER_REGISTRY, createAdapter, adapterMode };

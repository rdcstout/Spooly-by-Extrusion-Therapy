const { BambuAdapter } = require('./bambu');
const { launch } = require('../bambu-fallback');

class BambuFallbackAdapter extends BambuAdapter {
  constructor(config, options = {}) {
    super(config, options);
    this.launch = options.launch || launch;
    this.retryMs = options.retryMs || 30000;
    this.staleMs = options.staleMs || 150000;
    this.worker = null;
    this.retryTimer = null;
    this.staleTimer = null;
    this.generation = 0;
  }
  connect(onUpdate, onConnected = () => {}, onStatus = () => {}) {
    if (this.worker || this.retryTimer) return;
    this.isDisconnecting = false;
    const generation = ++this.generation;
    if (!this.hasConnected) this.connectionStatus(onStatus, { phase: 'connecting', message: 'Trying Bambu Fallback…' });
    let received = false, failed = false;
    const fail = reason => {
      if (failed || this.isDisconnecting || generation !== this.generation) return;
      failed = true;
      clearTimeout(this.staleTimer);clearTimeout(this.completionTimer);
      this.worker?.kill();this.worker = null;
      onUpdate({ id: this.config.id, name: this.config.name, type: 'bambu', status: 'offline', message: '' });
      const messages = {
        session: 'Bambu Fallback is unavailable. Try the regular Bambu connection or contact support with this error code.',
        unavailable: 'Bambu Fallback is unavailable on this computer. Try the regular Bambu connection.',
        serial: 'Bambu Fallback needs a valid printer serial number.',
      };
      if (!this.hasConnected) this.connectionStatus(onStatus, { phase: 'failed', code: 'BAMBU-FALLBACK-01', message: messages[reason] || 'Bambu Fallback could not receive printer status. Check your internet connection and that the printer is online.' });
      this.retryTimer = setTimeout(() => { this.retryTimer = null;this.connect(onUpdate, onConnected, onStatus); }, this.retryMs);
    };
    this.staleTimer = setTimeout(() => fail('timeout'), this.staleMs);
    try {
      this.worker = this.launch(this.config.serial, event => {
        if (failed || this.isDisconnecting || generation !== this.generation) return;
        if (event.kind === 'report') {
          // A delta is not enough to establish a new connection's job state.
          if (!received && typeof event.report.print.gcode_state !== 'string') return;
          if (!received) this.latestPrint = {};
          this.processReport(event.report, onUpdate);
          clearTimeout(this.staleTimer);this.staleTimer = setTimeout(() => fail('stale'), this.staleMs);
          if (!received) {
            received = true;
            if (!this.hasConnected) { this.hasConnected = true;this.connectionStatus(onStatus, { phase: 'connected', message: 'Connected successfully.' });onConnected(this.config); }
          }
        } else if (event.kind === 'error' || event.kind === 'exit' || (event.kind === 'connection' && event.value === 'offline')) fail(event.value);
      });
    } catch (error) { fail(error.message); }
  }
  disconnect() {
    this.generation++;this.isDisconnecting = true;
    clearTimeout(this.retryTimer);clearTimeout(this.staleTimer);
    this.retryTimer = null;this.staleTimer = null;
    this.worker?.kill();this.worker = null;
    super.disconnect();
  }
}
module.exports = { BambuFallbackAdapter };

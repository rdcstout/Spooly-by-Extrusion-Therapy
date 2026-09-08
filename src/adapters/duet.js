// Duet3D / RepRapFirmware: targets the object-model HTTP API (GET /rr_model) rather than the
// classic rr_status endpoint, since RepRapFirmware's own docs mark rr_status deprecated and
// scheduled for removal in RRF 3.6. rr_model works directly against a bare Duet board's built-in
// web server in standalone mode (no attached Pi / Duet Software Framework required), and no
// rr_connect call is needed either: RepRapFirmware auto-creates a session for any HTTP request
// when no machine password is set.
class DuetAdapter {
  constructor(config) {
    this.config = config;
    this.runningJob = null;
    this.completedJob = null;
  }

  get baseUrl() {
    const host = this.config.host.replace(/^https?:\/\//, '');
    return `http://${host}:${this.config.port || 80}`;
  }

  async read() {
    const response = await fetch(`${this.baseUrl}/rr_model?key=&flags=d99fn`, { signal: AbortSignal.timeout(3500) });
    if (!response.ok) throw new Error(`Duet returned ${response.status}`);
    const body = await response.json();
    return this.toPrinterState(body?.result || {});
  }

  selectActiveToolHeaterIndex(model, kind) {
    const tools = Array.isArray(model.tools) ? model.tools : [];
    const state = model.state || {};
    const currentToolIndex = Number.isInteger(state.currentTool) && state.currentTool >= 0 ? state.currentTool : 0;
    const tool = tools[currentToolIndex] || tools[0];
    const heaters = Array.isArray(tool?.[kind]) ? tool[kind] : Array.isArray(tool?.heaters) ? tool.heaters : [];
    const heaterIndex = heaters[0];
    return Number.isInteger(heaterIndex) && heaterIndex >= 0 ? heaterIndex : null;
  }

  toPrinterState(model = {}) {
    const state = model.state || {};
    const job = model.job || {};
    const heat = model.heat || {};
    const heaters = Array.isArray(heat.heaters) ? heat.heaters : [];
    const fansModel = Array.isArray(model.fans) ? model.fans : [];
    const filamentMonitors = Array.isArray(model.sensors?.filamentMonitors) ? model.sensors.filamentMonitors : [];

    const numeric = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
      ? Number(value)
      : null;

    const rawStatus = state.status || 'idle';
    const filamentOut = filamentMonitors.some((monitor) => monitor?.status === 'noFilament');

    const nozzleHeaterIndex = this.selectActiveToolHeaterIndex(model, 'heaters');
    const nozzleHeater = nozzleHeaterIndex === null ? null : heaters[nozzleHeaterIndex];
    const bedHeaterIndex = Array.isArray(heat.bedHeaters) ? heat.bedHeaters[0] : undefined;
    const bedHeater = Number.isInteger(bedHeaterIndex) && bedHeaterIndex >= 0 ? heaters[bedHeaterIndex] : null;

    const fileSize = numeric(job.file?.size);
    const filePosition = numeric(job.filePosition);
    const rawProgress = fileSize && filePosition !== null ? (filePosition / fileSize) * 100 : null;
    const progress = rawProgress === null ? null : Math.max(0, Math.min(100, rawProgress));
    const jobName = job.file?.fileName || '';

    // RepRapFirmware has no terminal "print finished" machine status: a
    // completed print simply drops back to `idle`. Spooly's completed-print
    // state (and its celebration) depends on a 'complete' status, so the
    // running job is tracked here and completion is reported once a print
    // that reached the end of its file leaves the processing state. A
    // cancelled or halted print never reaches the end, so it never reports
    // completion.
    const printingNow = rawStatus === 'processing' || rawStatus === 'simulating';
    const abandoned = rawStatus === 'cancelling' || rawStatus === 'halted';
    if (printingNow) {
      this.runningJob = { name: jobName, progress };
      this.completedJob = null;
    } else if (abandoned) {
      this.runningJob = null;
      this.completedJob = null;
    } else if (this.runningJob) {
      const reachedEnd = this.runningJob.progress !== null && this.runningJob.progress >= 99;
      this.completedJob = reachedEnd ? this.runningJob : null;
      this.runningJob = null;
    }

    let status = 'idle';
    if (printingNow) status = 'printing';
    else if (rawStatus === 'paused' || rawStatus === 'pausing' || rawStatus === 'resuming') status = 'paused';
    else if (rawStatus === 'halted') status = 'error';
    else if (this.completedJob) status = 'complete';
    if (filamentOut) status = 'filament_out';

    const completed = status === 'complete';

    return {
      id: this.config.id,
      name: this.config.name,
      type: 'duet',
      status,
      message: filamentOut ? 'Filament runout reported' : (rawStatus === 'halted' ? 'Machine halted' : ''),
      attention: null,
      filename: completed ? this.completedJob.name : jobName,
      progress: completed ? 100 : progress,
      nozzleTemp: numeric(nozzleHeater?.current),
      nozzleTarget: numeric(nozzleHeater?.active),
      bedTemp: numeric(bedHeater?.current),
      bedTarget: numeric(bedHeater?.active),
      fans: fansModel.map((fan, index) => ({
        key: `fan${index}`,
        label: fan?.name || `FAN ${index}`,
        on: numeric(fan?.actualValue) > 0,
      })),
    };
  }
}

module.exports = { DuetAdapter };

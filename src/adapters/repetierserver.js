// Repetier-Server: job/progress data and heater/fan telemetry live behind two different
// dyn-requests of Repetier-Server's REST API (both documented as "websocket commands callable
// as REST" at https://www.repetier-server.com/manuals/programming/API/index.html):
//   - GET /printer/list                         -> { data: [ { slug, online, paused, jobstate,
//                                                     job, done, ... } ] } for ALL configured
//                                                     printers (job name, progress %, pause/
//                                                     online flags; confirmed field names via
//                                                     the actively maintained RepetierServerSharpApi
//                                                     client's JsonProperty-annotated models).
//   - GET /printer/api/<slug>?a=stateList        -> { <slug>: { extruder: [{tempRead,tempSet,
//                                                     error}], heatedBeds: [{tempRead,tempSet,
//                                                     error}], fans: [{on,voltage}], ... } } for
//                                                     one printer's live heater/fan telemetry.
// The API key is sent as an `X-Api-Key` request header, not a query param: confirmed against
// OrcaSlicer's (and upstream PrusaSlicer's) actively-maintained Repetier-Server print-host
// client (src/slic3r/Utils/Repetier.cpp, Repetier::set_auth()), which does
// `http.header("X-Api-Key", apikey)` for every request against these same `printer/list` and
// `printer/api/<slug>` endpoints.
// jobstate only distinguishes "running" from not-running (RepetierServerSharpApi's
// RepetierCurrentPrintInfo maps jobstate === 'running' to in-progress, anything else to
// completed) - there is no documented terminal "finished" job state. Spooly's 'complete'
// status is therefore derived from the running-to-not-running transition of a job that
// reached the end of its progress (see toPrinterState). There is no filament-runout sensor
// field anywhere in this API, so 'filament_out' is never produced here.
class RepetierServerAdapter {
  constructor(config) {
    this.config = config;
    this.runningJob = null;
    this.completedJob = null;
  }

  get baseUrl() {
    const host = this.config.host.replace(/^https?:\/\//, '');
    return `http://${host}:${this.config.port || 3344}`;
  }

  get authHeaders() {
    return this.config.apiKey ? { 'X-Api-Key': this.config.apiKey } : {};
  }

  async fetchPrinterList() {
    const listUrl = `${this.baseUrl}/printer/list`;
    const listResponse = await fetch(listUrl, { headers: this.authHeaders, signal: AbortSignal.timeout(3500) });
    if (!listResponse.ok) throw new Error(`RepetierServer returned ${listResponse.status}`);
    const listBody = await listResponse.json();
    return Array.isArray(listBody?.data) ? listBody.data : [];
  }

  // Used by the settings UI's "Fetch printers" picker (see main.js's
  // repetierserver:list-printers IPC handler) so a user can pick a slug
  // instead of typing it blind.
  async listPrinters() {
    const printers = await this.fetchPrinterList();
    return printers
      .filter((printer) => printer?.slug)
      .map((printer) => ({ slug: printer.slug, name: printer.name || printer.slug }));
  }

  async read() {
    const slug = this.config.slug;
    const stateUrl = `${this.baseUrl}/printer/api/${encodeURIComponent(slug)}?a=stateList`;

    const [printers, stateResponse] = await Promise.all([
      this.fetchPrinterList(),
      fetch(stateUrl, { headers: this.authHeaders, signal: AbortSignal.timeout(3500) }),
    ]);
    if (!stateResponse.ok) throw new Error(`RepetierServer returned ${stateResponse.status}`);

    const stateBody = await stateResponse.json();
    const printerEntry = printers.find((printer) => printer?.slug === slug) || null;
    const stateEntry = stateBody?.[slug] || null;

    return this.toPrinterState(printerEntry, stateEntry);
  }

  toPrinterState(printerEntry = null, stateEntry = null) {
    const numeric = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
      ? Number(value)
      : null;

    const online = Boolean(printerEntry?.online);
    const paused = Boolean(printerEntry?.paused);
    const running = printerEntry?.jobstate === 'running';

    const extruders = Array.isArray(stateEntry?.extruder) ? stateEntry.extruder : [];
    const activeExtruderIndex = Number.isInteger(stateEntry?.activeExtruder) && stateEntry.activeExtruder >= 0
      ? stateEntry.activeExtruder
      : 0;
    const nozzleHeater = extruders[activeExtruderIndex] || extruders[0] || null;
    // Repetier-Server's documented stateList payload reports a single
    // `heatedBed` object and a `fanOn`/`fanVoltage` pair; newer builds report
    // `heatedBeds` and `fans` arrays instead. Accept both shapes.
    const bedHeaters = Array.isArray(stateEntry?.heatedBeds) ? stateEntry.heatedBeds : [];
    const bedHeater = bedHeaters[0] || stateEntry?.heatedBed || null;

    const heaterHasError = (heater) => numeric(heater?.error) > 0;
    const hasHeaterError = heaterHasError(nozzleHeater) || heaterHasError(bedHeater);

    const rawProgress = numeric(printerEntry?.done);
    const progress = rawProgress === null ? null : Math.max(0, Math.min(100, rawProgress));
    const jobName = printerEntry?.job || '';

    // Repetier-Server has no terminal "finished" job state: a finished print
    // simply stops being `running`. Spooly's completion celebration depends on
    // a 'complete' status, so track the running job here and report completion
    // once when a print that reached the end drops out of the running state.
    if (running) {
      this.runningJob = { name: jobName, progress };
      this.completedJob = null;
    } else if (this.runningJob && online) {
      const reachedEnd = this.runningJob.progress !== null && this.runningJob.progress >= 99;
      this.completedJob = reachedEnd ? this.runningJob : null;
      this.runningJob = null;
    }
    if (!online) { this.runningJob = null; this.completedJob = null; }
    const completed = Boolean(this.completedJob) && !running && !paused;

    let status = 'idle';
    if (!online) status = 'offline';
    else if (hasHeaterError) status = 'error';
    else if (paused) status = 'paused';
    else if (running) status = 'printing';
    else if (completed) status = 'complete';

    const fansSource = Array.isArray(stateEntry?.fans)
      ? stateEntry.fans
      : (stateEntry && 'fanOn' in stateEntry ? [{ on: stateEntry.fanOn, voltage: stateEntry.fanVoltage }] : []);
    const fans = fansSource.map((fan, index) => ({
      key: `fan${index}`,
      label: `FAN ${index}`,
      on: Boolean(fan?.on),
    }));

    return {
      id: this.config.id,
      name: this.config.name,
      type: 'repetierserver',
      status,
      message: hasHeaterError ? 'Heater error reported' : '',
      attention: null,
      filename: completed ? this.completedJob.name : jobName,
      progress: completed ? 100 : progress,
      nozzleTemp: numeric(nozzleHeater?.tempRead),
      nozzleTarget: numeric(nozzleHeater?.tempSet),
      bedTemp: numeric(bedHeater?.tempRead),
      bedTarget: numeric(bedHeater?.tempSet),
      fans,
    };
  }
}

module.exports = { RepetierServerAdapter };

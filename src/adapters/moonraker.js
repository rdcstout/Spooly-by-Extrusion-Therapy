class MoonrakerAdapter {
  constructor(config) {
    this.config = config;
    this.extruderNames = null;
  }

  get baseUrl() {
    const raw = String(this.config.host || '').trim().replace(/\/+$/, '');
    const schemeMatch = /^(https?):\/\//.exec(raw);
    const authority = raw.replace(/^https?:\/\//, '');
    const portMatch = /:(\d+)$/.exec(authority);
    const host = portMatch ? authority.slice(0, -portMatch[0].length) : authority;
    // A LAN address - a bare IPv4, "localhost", an mDNS ".local" name, or a
    // single-label hostname - is a direct Moonraker box, so it keeps the
    // historical http + 7125 default. Anything with a real domain suffix is
    // almost always a reverse proxy on 80/443, so it defaults to https and
    // never gets 7125 forced onto it. An explicitly typed scheme always wins.
    const isLanHost = /^(\d{1,3}\.){3}\d{1,3}$/.test(host)
      || host === 'localhost'
      || /\.local$/i.test(host)
      || !host.includes('.');
    const scheme = schemeMatch ? schemeMatch[1] : (isLanHost ? 'http' : 'https');
    const port = portMatch ? portMatch[1]
      : (this.config.port || (scheme === 'http' && isLanHost ? 7125 : null));
    return port ? `${scheme}://${host}:${port}` : `${scheme}://${host}`;
  }

  async discoverExtruders() {
    if (this.extruderNames) return this.extruderNames;
    const response = await fetch(`${this.baseUrl}/printer/objects/list`, { signal: AbortSignal.timeout(3500) });
    if (!response.ok) throw new Error(`Moonraker returned ${response.status}`);
    const body = await response.json();
    const objects = Array.isArray(body?.result?.objects) ? body.result.objects : [];
    const extruders = objects.filter((name) => /^extruder\d*$/.test(name));
    this.extruderNames = extruders.length ? extruders : ['extruder'];
    return this.extruderNames;
  }

  selectActiveExtruder(status, extruderNames = ['extruder']) {
    const activeName = status.toolhead?.extruder;
    if (activeName && status[activeName]) return status[activeName];
    if (status.extruder) return status.extruder;
    return extruderNames.map((name) => status[name]).find(Boolean);
  }

  async read() {
    const extruderNames = await this.discoverExtruders();
    const extruderQuery = extruderNames.map((name) => `${encodeURIComponent(name)}=temperature,target`).join('&');
    const url = `${this.baseUrl}/printer/objects/query?print_stats&virtual_sdcard=progress&toolhead=extruder&${extruderQuery}&heater_bed=temperature,target&fan=speed&filament_switch_sensor%20filament_sensor`;
    const response = await fetch(url, { signal: AbortSignal.timeout(3500) });
    if (!response.ok) throw new Error(`Moonraker returned ${response.status}`);
    const body = await response.json();
    const status = body?.result?.status || {};
    const stats = status.print_stats || {};
    const sensor = status['filament_switch_sensor filament_sensor'];
    return this.toPrinterState(stats, sensor, {
      virtualSdcard: status.virtual_sdcard,
      extruder: this.selectActiveExtruder(status, extruderNames),
      heaterBed: status.heater_bed,
      fans: status.fan === undefined ? [] : [{ key: 'part', label: 'PART', on: Number(status.fan.speed) > 0 }],
    });
  }

  toPrinterState(stats, sensor, telemetry = {}) {
    const state = stats.state || 'standby';
    const message = stats.message || '';
    const filamentOut = sensor && sensor.filament_detected === false;
    let status = 'idle';
    if (filamentOut) status = 'filament_out';
    else if (state === 'printing') status = 'printing';
    else if (state === 'paused') status = 'paused';
    else if (state === 'complete') status = 'complete';
    else if (state === 'error' || message) status = 'error';
    const numeric = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
      ? Number(value)
      : null;
    const rawProgress = numeric(telemetry.virtualSdcard?.progress);
    const progress = rawProgress === null ? null : Math.max(0, Math.min(100, rawProgress * 100));
    return {
      id: this.config.id,
      name: this.config.name,
      type: 'moonraker',
      status,
      message: filamentOut ? 'Filament runout reported' : message,
      attention: state === 'cancelled' ? { type: 'stopped', message: 'Print stopped' } : null,
      filename: stats.filename || '',
      progress,
      nozzleTemp: numeric(telemetry.extruder?.temperature),
      nozzleTarget: numeric(telemetry.extruder?.target),
      bedTemp: numeric(telemetry.heaterBed?.temperature),
      bedTarget: numeric(telemetry.heaterBed?.target),
      fans: Array.isArray(telemetry.fans) ? telemetry.fans : [],
    };
  }
}

module.exports = { MoonrakerAdapter };

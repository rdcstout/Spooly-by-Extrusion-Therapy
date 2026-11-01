const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { aggregatePrinters, completionFallbackStatus } = require('../src/state');

function renderer() {
  const handlers = {};
  const stage = { className: '', classList: { add() {}, remove() {} } };
  const sprite = { src: '' };
  const pet = { addEventListener(name, handler) { handlers[name] = handler; } };
  let timer = 0;
  const context = vm.createContext({
    document: { querySelector: (selector) => ({ '#stage': stage, '#pet': pet, '#petSprite': sprite })[selector] },
    Image: class { decode() { return Promise.resolve(); } },
    setTimeout: () => ++timer, setInterval: () => ++timer,
    clearTimeout() {}, clearInterval() {},
    window: { spooly: {
      onSnapshot() {}, onEasterEgg() {}, getSnapshot: () => ({ then() {} }), inspectStatus() {},
    } },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/renderer/pet.js'), 'utf8') +
    '\nglobalThis.testRender = render;', context);
  return { render: context.testRender, stage, sprite, click: () => handlers.click({ stopPropagation() {} }) };
}

function snapshot(printers) {
  return { ...aggregatePrinters(printers), completionFallbackStatus: completionFallbackStatus(printers), onboarded: true, bouncing: false };
}

const finished = (key = '') => ({ id: 'finished', status: 'complete', completionEventKey: key });
const active = (status = 'printing') => ({ id: 'active', status });

test('stale completion yields to printing on startup without changing reported status, in either order', () => {
  for (const printers of [[finished(), active()], [active(), finished()]]) {
    const r = renderer();
    const state = snapshot(printers);
    r.render(state);
    assert.equal(state.status, 'complete');
    assert.equal(state.printers.find((p) => p.id === 'finished').status, 'complete');
    assert.equal(r.stage.className, 'printing');
    assert.match(r.sprite.src, /printing-higgsfield-loop/);
  }
});

test('new completion celebrates; acknowledgment immediately restores ongoing printing and stays there', () => {
  const r = renderer();
  const state = snapshot([finished('job-1'), active()]);
  r.render(state);
  assert.equal(r.stage.className, 'complete');
  r.click();
  assert.equal(r.stage.className, 'printing');
  assert.match(r.sprite.src, /printing-higgsfield-loop/);
  for (let i = 0; i < 5; i++) r.render(state);
  assert.equal(r.stage.className, 'printing');
  r.render(snapshot([finished('job-2'), active()]));
  assert.equal(r.stage.className, 'complete');
});

test('acknowledged completion follows subsequent fleet transitions, including attention states', () => {
  const r = renderer();
  r.render(snapshot([finished('job-1'), active()]));
  r.click();
  for (const status of ['paused', 'error', 'filament_out', 'printing', 'idle', 'offline']) {
    r.render(snapshot([finished('job-1'), active(status)]));
    assert.equal(r.stage.className, status === 'offline' ? 'idle' : status);
  }
});

test('completion without an active printer rests idle; an entirely offline fleet stays offline', () => {
  const r = renderer();
  r.render(snapshot([finished()]));
  assert.equal(r.stage.className, 'idle');
  r.render(snapshot([active('offline')]));
  assert.equal(r.stage.className, 'offline');
});

test('attention interrupts a celebration and acknowledgment cannot hide it', () => {
  const r = renderer();
  r.render(snapshot([finished('job-1'), active()]));
  r.render(snapshot([finished('job-1'), active('paused')]));
  r.click();
  assert.equal(r.stage.className, 'paused');
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
test('Linux release configuration preserves sandboxing and desktop launch flags', () => {
  const config = require('../linux-release-builder.cjs');
  assert.equal(config.productName, 'Spooly');
  assert.equal(config.linux.executableName, 'spooly');
  assert.deepEqual(config.appImage.executableArgs, ['--ozone-platform=x11', '--disable-gpu']);
});
test('Linux private restrictions are version-gated rather than applied to public Linux builds', () => {
  const main = fs.readFileSync(require.resolve('../src/main.js'), 'utf8');
  assert.match(main, /const linuxTest = process.platform === 'linux' &&/);
  assert.match(main, /if \(linuxTest\) throw new Error\('Private Linux test/);
  assert.match(main, /automaticUpdates: linuxTest \? false : store.get/);
  assert.match(main, /linuxTest \? 'spooly-linux-test' : 'spooly'/);
});
test('AppImage installer grants namespaces only at a fixed root-owned path', () => {
  const script = fs.readFileSync(require.resolve('../scripts/install-linux-appimage.sh'), 'utf8');
  assert.match(script, /profile spooly-appimage \/opt\/spooly-appimage\/Spooly.AppImage/);
  assert.match(script, /install -o root -g root -m 755/);
  assert.doesNotMatch(script, /--no-sandbox|sysctl\s+-w/);
});
test('Linux packaging starts from source output rather than an installed test application', () => {
  const script = fs.readFileSync(require.resolve('../scripts/build-linux-native.sh'), 'utf8');
  assert.match(script, /dist-linux-release\/linux-unpacked/);
  assert.match(script, /project\/package.json/);
  assert.match(script, /project\/assets\/spooly-idle-full.png/);
  assert.doesNotMatch(script, /\/opt\/spooly-linux-test|version=0\.1\.18/);
});
test('AppImage removal is scoped and preserves user configuration', () => {
  const script = fs.readFileSync(require.resolve('../scripts/uninstall-linux-appimage.sh'), 'utf8');
  assert.match(script, /\.spooly-managed/);
  assert.match(script, /apparmor_parser -R/);
  assert.doesNotMatch(script, /rm\s+-[a-z]*r|\.config|sysctl/);
});

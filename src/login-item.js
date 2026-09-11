function shouldManageLoginItem({ isPackaged, platform, executablePath }) {
  if (platform !== 'darwin' && platform !== 'win32') return false;
  if (!isPackaged) return false;

  // A packaged app opened directly from its DMG would leave macOS pointing at
  // an app path that disappears as soon as the disk image is ejected.
  if (platform === 'darwin' && executablePath.startsWith('/Volumes/')) return false;

  return true;
}

function syncLaunchAtLogin(electronApp, enabled, platform = process.platform) {
  const executablePath = electronApp.getPath('exe');
  if (!shouldManageLoginItem({
    isPackaged: electronApp.isPackaged,
    platform,
    executablePath,
  })) return false;

  const settings = { openAtLogin: Boolean(enabled) };
  if (platform === 'win32') settings.path = executablePath;
  electronApp.setLoginItemSettings(settings);
  return true;
}

module.exports = { shouldManageLoginItem, syncLaunchAtLogin };

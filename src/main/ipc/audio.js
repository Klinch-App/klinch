const { ipcMain, shell } = require('electron');
const { exec } = require('child_process');
const path = require('path');

// Bundled ARM64 binary — no external dependencies required
const BIN = path.join(__dirname, '../../../bin/audio-devices');

const MULTI_OUTPUT_NAME = 'Klinch Multi-Output';
let previousOutputId = null;

function run(args) {
  return new Promise((resolve, reject) => {
    exec(`"${BIN}" ${args}`, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr?.trim() || err.message));
      else resolve(stdout.trim());
    });
  });
}

async function listDevices() {
  const json = await run('list --json');
  return JSON.parse(json);
}

function findBlackHole(devices) {
  return devices.find((d) => d.name.toLowerCase().includes('blackhole')) || null;
}

function findSpeakers(devices) {
  return devices.find((d) =>
    d.isOutput &&
    !d.name.toLowerCase().includes('blackhole') &&
    d.transportType !== 'aggregate'
  ) || null;
}

function findMultiOutput(devices) {
  return devices.find((d) => d.name === MULTI_OUTPUT_NAME) || null;
}

async function getSetupStatus() {
  const devices = await listDevices();
  return {
    blackholeInstalled: !!findBlackHole(devices),
    multiOutputReady:   !!findMultiOutput(devices),
  };
}

function init() {
  // ── Setup status ───────────────────────────────────────────────────────────
  ipcMain.handle('audio:setup-status', async () => {
    try {
      return await getSetupStatus();
    } catch (err) {
      console.error('[audio] setup-status error:', err.message);
      return { blackholeInstalled: false, multiOutputReady: false };
    }
  });

  // ── Auto-create Multi-Output Device ───────────────────────────────────────
  ipcMain.handle('audio:create-multi-output', async () => {
    try {
      const devices  = await listDevices();
      const bh       = findBlackHole(devices);
      const speakers = findSpeakers(devices);

      if (!bh)       return { ok: false, error: 'BlackHole not found' };
      if (!speakers) return { ok: false, error: 'No speakers found' };

      console.log(`[audio] creating Multi-Output: "${speakers.name}" + "${bh.name}"`);

      // Speakers are the clock master; BlackHole is secondary
      const result = await run(
        `aggregate create "${MULTI_OUTPUT_NAME}" ${speakers.id} ${bh.id} --multi-output --json`
      );
      const device = JSON.parse(result);
      console.log('[audio] created:', device.name, 'id:', device.id);

      // Set it as the system output immediately
      await run(`output set ${device.id}`);
      console.log('[audio] set as default output');

      return { ok: true, name: device.name };
    } catch (err) {
      console.error('[audio] create-multi-output error:', err.message);
      return { ok: false, error: err.message };
    }
  });

  // ── Open BlackHole download page ───────────────────────────────────────────
  ipcMain.handle('audio:open-blackhole-download', () => {
    shell.openExternal('https://existential.audio/blackhole/');
  });

  // ── Switch output for interview ────────────────────────────────────────────
  ipcMain.handle('audio:switch-for-interview', async () => {
    try {
      const current = JSON.parse(await run('output get --json'));
      previousOutputId = current.id;
      console.log('[audio] saving output:', current.name);

      const devices = await listDevices();
      const mo = findMultiOutput(devices);
      if (!mo) return { ok: false, error: 'Klinch Multi-Output not found' };

      await run(`output set ${mo.id}`);
      console.log('[audio] switched to:', mo.name);
      return { ok: true };
    } catch (err) {
      console.warn('[audio] switch failed:', err.message);
      return { ok: false, error: err.message };
    }
  });

  // ── Restore output after interview ─────────────────────────────────────────
  ipcMain.handle('audio:restore-output', async () => {
    if (!previousOutputId) return { ok: true };
    try {
      await run(`output set ${previousOutputId}`);
      console.log('[audio] restored output id:', previousOutputId);
      previousOutputId = null;
      return { ok: true };
    } catch (err) {
      console.warn('[audio] restore failed:', err.message);
      return { ok: false, error: err.message };
    }
  });
}

module.exports = { init };

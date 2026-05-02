const { ipcMain, shell } = require('electron');
const { exec } = require('child_process');
const path = require('path');

// Bundled ARM64 binary — no external dependencies required
const BIN = path.join(__dirname, '../../../bin/audio-devices');

const MULTI_OUTPUT_NAME = 'Klinch Multi-Output';
let previousOutputId   = null;
let previousOutputName = null;

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

      // Do NOT set as system output here — output is switched only at interview
      // start via audio:switch-for-interview, so the system default is never
      // permanently changed by the setup flow.

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
      const devices = await listDevices();
      const mo = findMultiOutput(devices);
      if (!mo) return { ok: false, error: 'Klinch Multi-Output not found' };

      // If already on Multi-Output (stuck from a previous session that didn't
      // restore), save real speakers as the restore target instead of saving
      // Multi-Output, which would make the restore circular.
      if (current.name === MULTI_OUTPUT_NAME) {
        const speakers = findSpeakers(devices);
        if (speakers) {
          previousOutputId   = speakers.id;
          previousOutputName = speakers.name;
          console.log('[audio] already on Multi-Output — saving speakers as restore target:', speakers.name);
        } else {
          console.warn('[audio] already on Multi-Output and no speakers found — cannot save restore target');
          previousOutputId   = null;
          previousOutputName = null;
        }
      } else {
        previousOutputId   = current.id;
        previousOutputName = current.name;
        console.log('[audio] saving output:', current.name);
      }

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
      console.log('[audio] restored output to:', previousOutputName, '(id:', previousOutputId + ')');
      previousOutputId   = null;
      previousOutputName = null;

      // Verify we actually left Multi-Output — if still stuck, force speakers
      const after = JSON.parse(await run('output get --json'));
      if (after.name === MULTI_OUTPUT_NAME) {
        console.warn('[audio] still on Multi-Output after restore — forcing speakers');
        const devices  = await listDevices();
        const speakers = findSpeakers(devices);
        if (speakers) await run(`output set ${speakers.id}`);
      }

      return { ok: true };
    } catch (err) {
      console.warn('[audio] restore failed:', err.message);
      return { ok: false, error: err.message };
    }
  });
}

// Called by main.js before-quit to ensure output is restored even on force-quit
async function forceRestoreOutput() {
  if (!previousOutputId) return;
  try {
    await run(`output set ${previousOutputId}`);
    console.log('[audio] force-restored output on quit:', previousOutputName);
    previousOutputId   = null;
    previousOutputName = null;
  } catch (err) {
    console.warn('[audio] force-restore failed:', err.message);
    // Last resort: enumerate devices and set speakers directly
    try {
      const devices  = await listDevices();
      const speakers = findSpeakers(devices);
      if (speakers) {
        await run(`output set ${speakers.id}`);
        console.log('[audio] last-resort restore to speakers:', speakers.name);
      }
    } catch (_) {}
  }
}

module.exports = { init, forceRestoreOutput };

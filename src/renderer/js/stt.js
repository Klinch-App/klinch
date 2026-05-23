// Candidate-only transcription: mic → single Deepgram socket.
// Speaker-labeled finals are stored for post-interview feedback.
// Candidate utterances are buffered and flushed to Claude for live coaching.

window.STT = (() => {
  // ── State ──────────────────────────────────────────────────────────────────
  let wsMic              = null;
  let recMic             = null;
  let streamMic          = null;
  let sessionActive      = false;
  let candidateBuf       = '';
  let _reconnectAttempts = 0;
  let _reconnectDeadline = 0;

  const RECONNECT_MAX_ATTEMPTS = 5;
  const RECONNECT_MAX_MS       = 30_000;

  const DG_BASE =
    'wss://api.deepgram.com/v1/listen' +
    '?model=nova-2' +
    '&language=en-US' +
    '&interim_results=true' +
    '&punctuate=true' +
    '&smart_format=true' +
    '&endpointing=400' +
    '&encoding=opus' +
    '&container=webm';

  // ── Device discovery ───────────────────────────────────────────────────────

  async function enumerateInputs() {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (_) {}
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === 'audioinput');
  }

  function pickMic(inputs) {
    return inputs.find((d) =>
      !d.label.toLowerCase().includes('blackhole') &&
      d.deviceId !== 'default' &&
      d.deviceId !== 'communications'
    ) || null;
  }

  // ── Audio stream ───────────────────────────────────────────────────────────

  async function openStream(deviceId) {
    return navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId:         deviceId ? { exact: deviceId } : undefined,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl:  true,
      },
      video: false,
    });
  }

  // ── Deepgram WebSocket ─────────────────────────────────────────────────────

  function connectDeepgram(stream) {
    return new Promise((resolve, reject) => {
      const apiKey = window.klinch.deepgramKey;
      if (!apiKey) { reject(new Error('DEEPGRAM_API_KEY not set')); return; }

      const socket = new WebSocket(DG_BASE, ['token', apiKey]);
      socket.binaryType = 'arraybuffer';

      socket.onopen = () => {
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus' : 'audio/webm';

        recMic = new MediaRecorder(stream, { mimeType });
        recMic.ondataavailable = (e) => {
          if (e.data.size > 0 && socket.readyState === WebSocket.OPEN) {
            socket.send(e.data);
          }
        };
        recMic.start(250);
        resolve(socket);
      };

      socket.onerror = (e) => {
        reject(new Error(`WebSocket error (candidate): ${e.message ?? e.type}`));
      };

      socket.onclose = () => {
        if (recMic && recMic.state !== 'inactive') recMic.stop();
        recMic = null;

        if (sessionActive) {
          if (_reconnectDeadline === 0) _reconnectDeadline = Date.now() + RECONNECT_MAX_MS;
          setTimeout(() => reconnect(), 1000);
        }
      };

      socket.onmessage = (e) => {
        let msg;
        try { msg = JSON.parse(e.data); } catch { return; }
        if (msg.type !== 'Results') return;

        const transcript = msg.channel?.alternatives?.[0]?.transcript || '';
        if (!transcript) return;

        if (msg.is_final) {
          window.klinch.send('interview:transcript-entry', {
            speaker:   'you',
            text:      transcript,
            timestamp: Date.now(),
          });

          document.dispatchEvent(new CustomEvent('stt:final', { detail: { text: transcript, speaker: 'you' } }));

          candidateBuf += transcript + ' ';
          if (msg.speech_final) flushCandidateBuf();
        } else {
          document.dispatchEvent(new CustomEvent('stt:interim', { detail: { text: transcript, speaker: 'you' } }));
        }
      };
    });
  }

  async function reconnect() {
    if (!sessionActive || !streamMic) return;

    _reconnectAttempts++;
    const gaveUp = _reconnectAttempts > RECONNECT_MAX_ATTEMPTS
                || Date.now() > _reconnectDeadline;

    if (gaveUp) {
      window.klinch.send('stt:reconnect-failed');
      return;
    }

    try {
      wsMic = await connectDeepgram(streamMic);
      _reconnectAttempts = 0;
      _reconnectDeadline = 0;
    } catch {
      setTimeout(() => reconnect(), 2000);
    }
  }

  // ── Buffer flush ───────────────────────────────────────────────────────────

  function flushCandidateBuf() {
    const text = candidateBuf.trim();
    candidateBuf = '';
    if (text && sessionActive) {
      window.klinch.send('interview:question', text);
    }
  }

  // Cmd+Return → manual flush
  window.klinch.on('interview:manual-trigger', () => flushCandidateBuf());

  // ── Session lifecycle ──────────────────────────────────────────────────────

  async function startSession(interviewId) {
    if (sessionActive) return true;

    const inputs = await enumerateInputs();
    const micDev  = pickMic(inputs);

    try {
      streamMic = await openStream(micDev?.deviceId || null);
    } catch {
      document.dispatchEvent(new CustomEvent('stt:device-status', { detail: 'error' }));
      return false;
    }

    try {
      wsMic = await connectDeepgram(streamMic);
    } catch {
      document.dispatchEvent(new CustomEvent('stt:device-status', { detail: 'error' }));
      streamMic?.getTracks().forEach((t) => t.stop());
      streamMic = null;
      return false;
    }

    sessionActive      = true;
    candidateBuf       = '';
    _reconnectAttempts = 0;
    _reconnectDeadline = 0;

    document.dispatchEvent(new CustomEvent('stt:device-status', { detail: 'mic' }));
    await window.klinch.invoke('interview:start', { interviewId: interviewId || null });
    return true;
  }

  async function stopSession() {
    if (!sessionActive) return;
    sessionActive = false;
    candidateBuf  = '';

    if (recMic && recMic.state !== 'inactive') recMic.stop();
    if (wsMic && wsMic.readyState === WebSocket.OPEN) {
      try { wsMic.send(JSON.stringify({ type: 'CloseStream' })); } catch (_) {}
      setTimeout(() => { try { wsMic.close(); } catch (_) {} }, 300);
    }

    recMic = null;
    wsMic  = null;

    streamMic?.getTracks().forEach((t) => t.stop());
    streamMic = null;

    await window.klinch.invoke('interview:stop');
  }

  return { startSession, stopSession };
})();

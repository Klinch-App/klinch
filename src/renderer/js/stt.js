// Candidate-only transcription: mic → single Deepgram socket.
// Speaker-labelled finals are stored for post-interview feedback.
// Candidate utterances are buffered and flushed to Claude for live coaching.

window.STT = (() => {
  // ── State ──────────────────────────────────────────────────────────────────
  let wsMic         = null;
  let recMic        = null;
  let streamMic     = null;
  let sessionActive = false;
  let candidateBuf  = '';

  const DG_BASE =
    'wss://api.deepgram.com/v1/listen' +
    '?model=nova-2' +
    '&language=en-US' +
    '&interim_results=true' +
    '&punctuate=true' +
    '&smart_format=true' +
    '&endpointing=400';

  // ── Device discovery ───────────────────────────────────────────────────────

  async function enumerateInputs() {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (_) {}
    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs = devices.filter((d) => d.kind === 'audioinput');
    console.log('[stt] audio inputs:', inputs.map((d) => `"${d.label}" [${d.deviceId.slice(0, 8)}]`));
    return inputs;
  }

  function pickMic(inputs) {
    const mic = inputs.find((d) =>
      !d.label.toLowerCase().includes('blackhole') &&
      d.deviceId !== 'default' &&
      d.deviceId !== 'communications'
    ) || null;
    if (mic) console.log('[stt] mic:', mic.label);
    else     console.warn('[stt] no mic found');
    return mic;
  }

  // ── Audio stream ───────────────────────────────────────────────────────────

  async function openStream(deviceId) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId:         deviceId ? { exact: deviceId } : undefined,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl:  true,
      },
      video: false,
    });
    const labels = stream.getAudioTracks().map((t) => `"${t.label}" state=${t.readyState}`);
    console.log('[stt] mic stream opened:', labels);
    return stream;
  }

  // ── Deepgram WebSocket ─────────────────────────────────────────────────────

  function connectDeepgram(stream) {
    return new Promise((resolve, reject) => {
      const apiKey = window.klinch.deepgramKey;
      if (!apiKey) { reject(new Error('DEEPGRAM_API_KEY not set')); return; }

      const socket = new WebSocket(DG_BASE, ['token', apiKey]);
      socket.binaryType = 'arraybuffer';

      socket.onopen = () => {
        console.log('[stt] Deepgram connected (candidate)');

        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus' : 'audio/webm';

        recMic = new MediaRecorder(stream, { mimeType });
        recMic.ondataavailable = (e) => {
          if (e.data.size > 0 && socket.readyState === WebSocket.OPEN) {
            socket.send(e.data);
          }
        };
        recMic.start(250);

        console.log(`[stt] MediaRecorder started (candidate) — ${mimeType}`);
        resolve(socket);
      };

      socket.onerror = () => reject(new Error('WebSocket error (candidate)'));

      socket.onclose = (e) => {
        console.log(`[stt] Deepgram closed (candidate) — code=${e.code}`);
        if (recMic && recMic.state !== 'inactive') recMic.stop();
        recMic = null;

        if (sessionActive) setTimeout(() => reconnect(), 1000);
      };

      socket.onmessage = (e) => {
        let msg;
        try { msg = JSON.parse(e.data); } catch { return; }
        if (msg.type !== 'Results') return;

        const transcript = msg.channel?.alternatives?.[0]?.transcript || '';
        if (!transcript) return;

        if (msg.is_final) {
          console.log(`[stt] final (candidate): "${transcript}" | speech_final=${msg.speech_final}`);

          window.klinch.send('interview:transcript-entry', {
            speaker: 'you',
            text:    transcript,
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
    console.log('[stt] reconnecting (candidate)…');
    try {
      wsMic = await connectDeepgram(streamMic);
    } catch (err) {
      console.error('[stt] reconnect failed (candidate):', err.message);
      setTimeout(() => reconnect(), 2000);
    }
  }

  // ── Buffer flush ───────────────────────────────────────────────────────────

  function flushCandidateBuf() {
    const text = candidateBuf.trim();
    candidateBuf = '';
    if (text && sessionActive) {
      console.log('[stt] flushing to Claude:', text);
      window.klinch.send('interview:question', text);
    }
  }

  // Cmd+Return → manual flush
  window.klinch.on('interview:manual-trigger', () => flushCandidateBuf());

  // ── Session lifecycle ──────────────────────────────────────────────────────

  async function startSession(interviewId) {
    if (sessionActive) return true;
    console.log('[stt] startSession()');

    const inputs = await enumerateInputs();
    const micDev  = pickMic(inputs);

    try {
      streamMic = await openStream(micDev?.deviceId || null);
    } catch (err) {
      console.error('[stt] mic stream failed:', err.message);
      document.dispatchEvent(new CustomEvent('stt:device-status', { detail: 'error' }));
      return false;
    }

    try {
      wsMic = await connectDeepgram(streamMic);
    } catch (err) {
      console.error('[stt] Deepgram (candidate) failed:', err.message);
      document.dispatchEvent(new CustomEvent('stt:device-status', { detail: 'error' }));
      streamMic?.getTracks().forEach((t) => t.stop());
      streamMic = null;
      return false;
    }

    sessionActive = true;
    candidateBuf  = '';

    document.dispatchEvent(new CustomEvent('stt:device-status', { detail: 'mic' }));
    await window.klinch.invoke('interview:start', { interviewId: interviewId || null });
    console.log('[stt] session active — mic:', !!wsMic);
    return true;
  }

  async function stopSession() {
    if (!sessionActive) return;
    console.log('[stt] stopSession()');
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

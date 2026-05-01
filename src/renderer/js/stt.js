// Dual-stream transcription: BlackHole (interviewer) + mic (you) → two Deepgram sockets.
// Speaker-labelled finals are stored for post-interview feedback.
// Only interviewer utterances are flushed to Claude for live coaching.

window.STT = (() => {
  // ── State ──────────────────────────────────────────────────────────────────
  let wsInterviewer  = null;
  let wsMic          = null;
  let recInterviewer = null;
  let recMic         = null;
  let streamBH       = null;
  let streamMic      = null;
  let sessionActive  = false;
  let interviewerBuf = '';

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

  function pickBlackHole(inputs) {
    const bh = inputs.find((d) => d.label.toLowerCase().includes('blackhole')) || null;
    if (bh) console.log('[stt] BlackHole:', bh.label);
    else    console.warn('[stt] BlackHole not found');
    return bh;
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

  // ── Audio streams ──────────────────────────────────────────────────────────

  async function openStream(deviceId, processAudio) {
    const audioConstraints = {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      echoCancellation: !deviceId,   // only for mic (deviceId = null means fallback)
      noiseSuppression: !deviceId,
      autoGainControl:  !deviceId,
    };
    const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false });
    const labels = stream.getAudioTracks().map((t) => `"${t.label}" state=${t.readyState}`);
    console.log('[stt] stream opened:', labels, '| processAudio:', processAudio);
    return stream;
  }

  // ── Deepgram WebSocket ─────────────────────────────────────────────────────

  function connectDeepgram(stream, speaker, isProcessAudio) {
    return new Promise((resolve, reject) => {
      const apiKey = window.klinch.deepgramKey;
      if (!apiKey) { reject(new Error('DEEPGRAM_API_KEY not set')); return; }

      const socket = new WebSocket(DG_BASE, ['token', apiKey]);
      socket.binaryType = 'arraybuffer';

      socket.onopen = () => {
        console.log(`[stt] Deepgram connected (${speaker})`);

        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus' : 'audio/webm';

        const recorder = new MediaRecorder(stream, { mimeType });
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && socket.readyState === WebSocket.OPEN) {
            socket.send(e.data);
          }
        };
        recorder.start(250);

        if (speaker === 'interviewer') recInterviewer = recorder;
        else                           recMic         = recorder;

        console.log(`[stt] MediaRecorder started (${speaker}) — ${mimeType}`);
        resolve(socket);
      };

      socket.onerror = () => reject(new Error(`WebSocket error (${speaker})`));

      socket.onclose = (e) => {
        console.log(`[stt] Deepgram closed (${speaker}) — code=${e.code}`);
        const rec = speaker === 'interviewer' ? recInterviewer : recMic;
        if (rec && rec.state !== 'inactive') { rec.stop(); }
        if (speaker === 'interviewer') recInterviewer = null;
        else                           recMic         = null;

        if (sessionActive) {
          const s = speaker === 'interviewer' ? streamBH : streamMic;
          setTimeout(() => reconnect(s, speaker, isProcessAudio), 1000);
        }
      };

      socket.onmessage = (e) => {
        let msg;
        try { msg = JSON.parse(e.data); } catch { return; }
        if (msg.type !== 'Results') return;

        const transcript = msg.channel?.alternatives?.[0]?.transcript || '';
        if (!transcript) return;

        if (msg.is_final) {
          console.log(`[stt] final (${speaker}): "${transcript}" | speech_final=${msg.speech_final}`);

          // Store for post-interview feedback
          window.klinch.send('interview:transcript-entry', {
            speaker,
            text: transcript,
            timestamp: Date.now(),
          });

          document.dispatchEvent(new CustomEvent('stt:final', { detail: { text: transcript, speaker } }));

          if (speaker === 'interviewer') {
            interviewerBuf += transcript + ' ';
            if (msg.speech_final) flushInterviewerBuf();
          }
        } else {
          // Interim — only show interviewer in overlay to avoid confusion
          if (speaker === 'interviewer') {
            window.klinch.send('interview:transcript', transcript);
          }
          document.dispatchEvent(new CustomEvent('stt:interim', { detail: { text: transcript, speaker } }));
        }
      };
    });
  }

  async function reconnect(stream, speaker, isProcessAudio) {
    if (!sessionActive || !stream) return;
    console.log(`[stt] reconnecting (${speaker})…`);
    try {
      const socket = await connectDeepgram(stream, speaker, isProcessAudio);
      if (speaker === 'interviewer') wsInterviewer = socket;
      else                           wsMic         = socket;
    } catch (err) {
      console.error(`[stt] reconnect failed (${speaker}):`, err.message);
      setTimeout(() => reconnect(stream, speaker, isProcessAudio), 2000);
    }
  }

  // ── Buffer flush ───────────────────────────────────────────────────────────

  function flushInterviewerBuf() {
    const question = interviewerBuf.trim();
    interviewerBuf = '';
    if (question && sessionActive) {
      console.log('[stt] flushing to Claude:', question);
      window.klinch.send('interview:question', question);
    }
  }

  // Cmd+Return → manual flush
  window.klinch.on('interview:manual-trigger', () => flushInterviewerBuf());

  // ── Session lifecycle ──────────────────────────────────────────────────────

  async function startSession() {
    if (sessionActive) return true;
    console.log('[stt] startSession()');

    const inputs  = await enumerateInputs();
    const bhDev   = pickBlackHole(inputs);
    const micDev  = pickMic(inputs);

    // Device status dot
    if (bhDev) {
      document.dispatchEvent(new CustomEvent('stt:device-status', { detail: 'blackhole' }));
    } else {
      document.dispatchEvent(new CustomEvent('stt:device-status', { detail: 'fallback' }));
    }

    // Switch system output to Klinch Multi-Output (BlackHole + speakers)
    const switchResult = await window.klinch.invoke('audio:switch-for-interview');
    if (!switchResult.ok) {
      console.warn('[stt] audio switch failed — interview continues without device switch');
    }

    // Open BlackHole stream (system/interviewer audio)
    try {
      streamBH = await openStream(bhDev?.deviceId || null, true);
    } catch (err) {
      console.error('[stt] BlackHole stream failed:', err.message);
      document.dispatchEvent(new CustomEvent('stt:device-status', { detail: 'error' }));
      return false;
    }

    // Open mic stream (user's voice)
    try {
      streamMic = await openStream(micDev?.deviceId || null, false);
    } catch (err) {
      console.warn('[stt] mic stream failed — continuing with BlackHole only:', err.message);
      streamMic = null;
    }

    // Connect Deepgram for both streams
    try {
      wsInterviewer = await connectDeepgram(streamBH, 'interviewer', true);
    } catch (err) {
      console.error('[stt] Deepgram (interviewer) failed:', err.message);
      document.dispatchEvent(new CustomEvent('stt:device-status', { detail: 'error' }));
      streamBH?.getTracks().forEach((t) => t.stop());
      streamBH = null;
      return false;
    }

    if (streamMic) {
      try {
        wsMic = await connectDeepgram(streamMic, 'you', false);
      } catch (err) {
        console.warn('[stt] Deepgram (mic) failed — continuing without mic:', err.message);
        streamMic?.getTracks().forEach((t) => t.stop());
        streamMic = null;
        wsMic = null;
      }
    }

    sessionActive = true;
    interviewerBuf = '';

    await window.klinch.invoke('interview:start');
    console.log('[stt] session active — interviewer:', !!wsInterviewer, '| mic:', !!wsMic);
    return true;
  }

  async function stopSession() {
    if (!sessionActive) return;
    console.log('[stt] stopSession()');
    sessionActive = false;
    interviewerBuf = '';

    for (const [rec, ws] of [[recInterviewer, wsInterviewer], [recMic, wsMic]]) {
      if (rec && rec.state !== 'inactive') rec.stop();
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify({ type: 'CloseStream' })); } catch (_) {}
        setTimeout(() => { try { ws.close(); } catch (_) {} }, 300);
      }
    }

    recInterviewer = null;
    recMic         = null;
    wsInterviewer  = null;
    wsMic          = null;

    streamBH?.getTracks().forEach((t) => t.stop());
    streamMic?.getTracks().forEach((t) => t.stop());
    streamBH  = null;
    streamMic = null;

    // Restore system audio output
    await window.klinch.invoke('audio:restore-output');
    await window.klinch.invoke('interview:stop');
  }

  return { startSession, stopSession };
})();

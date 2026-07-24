/*
 * Co-Cher Voice Input — press-to-talk Speech-to-Text (two backends)
 * =================================================================
 * A thin, honest wrapper that gives every mic in the app ONE controller
 * shape, backed by whichever engine actually works in this browser:
 *
 *  1. Web Speech API ((webkit)SpeechRecognition) — Chrome/Edge. Streaming,
 *     interim text, fast. BUT it is network-backed via Google's hosted
 *     speech service, which Chromium FORKS (Arc, Brave, …) ship without:
 *     there the constructor exists and then recognition fails instantly
 *     with a 'network' error even on perfect wifi.
 *  2. Recorder fallback — getUserMedia + MediaRecorder (universal), then
 *     transcription via the teacher's own Gemini key (api.js
 *     transcribeAudio — the same endpoint every other Co-Cher AI feature
 *     uses). Chosen automatically when (1) is missing (Firefox/Safari) or
 *     the moment it fails with a service error; the choice is remembered
 *     so later presses skip the broken engine.
 *
 * Either way the wrapper NEVER submits, sends, or mutates anything on its
 * own — it only hands text to your callbacks (teacher-leads principle).
 */

import { Store } from '../state.js';
import { transcribeAudio } from '../api.js';

const BACKEND_KEY = 'cocher_voice_backend';
let preferRecorder = (() => {
  try { return localStorage.getItem(BACKEND_KEY) === 'recorder'; } catch (_) { return false; }
})();
function rememberRecorderBackend() {
  preferRecorder = true;
  try { localStorage.setItem(BACKEND_KEY, 'recorder'); } catch (_) { /* ignore */ }
}

function speechCtor() {
  return (typeof window !== 'undefined') &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);
}
function canRecord() {
  return (typeof window !== 'undefined') &&
    !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
}

/**
 * Whether ANY dictation backend is available: built-in speech recognition,
 * or the record-and-transcribe fallback (mic capture is universal; the
 * Gemini key requirement is surfaced at press time, not render time).
 * @returns {boolean}
 */
export function isVoiceInputSupported() {
  return !!(speechCtor() || canRecord());
}

/* Every controller that is actively listening, so navigation can silence the
 * lot without each view wiring its own teardown (the bug class fixed for
 * Lesson Rehearsal, now guaranteed centrally — the router calls
 * abortAllDictations() on every route change). */
const activeDictations = new Set();

/** Abort every in-flight dictation (fires their onEnd). Safe to call anytime. */
export function abortAllDictations() {
  activeDictations.forEach((d) => { try { d.abort(); } catch (_) { /* already gone */ } });
  activeDictations.clear();
}

/**
 * One user-facing message per dictation failure class — or null for benign
 * ends (aborted / no speech) that deserve silence. Accepts either a
 * SpeechRecognitionErrorEvent (.error) or a thrown exception (.name).
 * @param {any} err
 * @returns {string|null}
 */
export function dictationErrorMessage(err) {
  const code = err?.error || err?.name || '';
  if (code === 'aborted' || code === 'AbortError' || code === 'no-speech') return null;
  if (code === 'no-key') {
    return 'This browser’s built-in dictation isn’t available — add your Gemini API key in Settings and Co-Cher will transcribe for you (Chrome/Edge have built-in dictation).';
  }
  if (code === 'not-allowed' || code === 'NotAllowedError' || code === 'service-not-allowed') {
    return 'Microphone access denied — allow the mic for this site in your browser settings.';
  }
  if (code === 'network') {
    return 'Voice input needs internet (speech is transcribed online) — check the connection and try again.';
  }
  if (code === 'audio-capture' || code === 'NotFoundError') {
    return 'No microphone found — check that a mic is connected and enabled.';
  }
  // Transcription helper throws plain Errors with useful text — pass those on.
  if (err instanceof Error && err.message) return err.message;
  return 'Voice input error — please try again.';
}

/**
 * @typedef {Object} DictationOptions
 * @property {(finalText: string) => void} [onResult]   Final transcript (streamed per utterance on Web Speech; once per press on the recorder fallback).
 * @property {(interimText: string) => void} [onInterim] Live, not-yet-final transcript (Web Speech only).
 * @property {(error: any) => void} [onError]           Error event / exception (classify with dictationErrorMessage).
 * @property {() => void} [onEnd]                       Fired once, when the press is fully over (incl. after fallback transcription).
 * @property {(phase: 'recording'|'transcribing') => void} [onPhase] Recorder-fallback progress, so the UI can say "Transcribing…".
 * @property {string} [lang]                            BCP-47 language tag; defaults to 'en-SG' (Singapore English).
 */

/**
 * Create a press-to-talk dictation controller: { start(): boolean, stop(), abort() }.
 * start() → true means "listening" (paint the mic hot). With the recorder
 * fallback, stop() ends the recording and the transcript arrives via
 * onResult after a short 'transcribing' phase. Robust to double-start.
 *
 * @param {DictationOptions} [options]
 */
export function createDictation(options = {}) {
  const { onResult, onInterim, onError, onEnd, onPhase, lang = 'en-SG' } = options;

  const Ctor = speechCtor();

  if (!Ctor && !canRecord()) {
    // No backend at all: honest no-op controller. Callers should have hidden the mic.
    return { start() { return false; }, stop() {}, abort() {} };
  }

  let recognition = null;
  let listening = false;
  let mode = null;              // 'sr' | 'rec'

  // Recorder state
  let recStream = null, recorder = null, recChunks = [], recTimer = null;
  let transcribing = false, discarded = false;

  const phase = (p) => { if (typeof onPhase === 'function') onPhase(p); };
  const fireError = (e) => { if (typeof onError === 'function') onError(e); };
  const finish = () => {
    activeDictations.delete(controller);
    if (typeof onEnd === 'function') onEnd();
  };

  /* ── Backend 1: Web Speech ── */
  function build() {
    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false; // press-to-talk: one utterance per press
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result && result[0] ? result[0].transcript : '';
        if (result && result.isFinal) finalText += transcript;
        else interimText += transcript;
      }
      if (interimText && typeof onInterim === 'function') onInterim(interimText);
      // Surface text ONLY — never auto-submit. The caller decides what happens.
      if (finalText && typeof onResult === 'function') onResult(finalText);
    };

    rec.onerror = (event) => {
      const code = event?.error || '';
      // The Arc/Brave signature: the service is unreachable BY DESIGN. Switch
      // to the recorder fallback within this same press (button stays hot),
      // and remember so future presses skip the broken engine entirely.
      // Neuter the dead recognition's handlers first — nothing it fires
      // during/after abort() may tear down the press we're handing over.
      if ((code === 'network' || code === 'service-not-allowed') && canRecord() && Store.get('apiKey')) {
        rememberRecorderBackend();
        rec.onresult = null; rec.onerror = null; rec.onend = null;
        try { rec.abort(); } catch (_) { /* already dead */ }
        beginRecorder();
        return;
      }
      fireError(event);
    };

    rec.onend = () => {
      listening = false;
      finish();
    };

    return rec;
  }

  /* ── Backend 2: record locally, transcribe with Gemini ── */
  function beginRecorder() {
    mode = 'rec';
    if (!Store.get('apiKey')) {
      listening = false;
      activeDictations.delete(controller);
      fireError({ error: 'no-key' });
      if (typeof onEnd === 'function') onEnd(); // reset any hot UI from a mid-press switch
      return false;
    }
    listening = true;
    discarded = false;
    activeDictations.add(controller);
    phase('recording');
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      if (!listening) { stream.getTracks().forEach(t => t.stop()); return; } // aborted while asking
      recStream = stream;
      recChunks = [];
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => { if (e.data && e.data.size) recChunks.push(e.data); };
      recorder.onstop = handleRecorderStop;
      recorder.start();
      // Press-to-talk, not open mic: hard cap so a forgotten press can't record forever.
      recTimer = setTimeout(() => controller.stop(), 60000);
    }).catch((err) => {
      listening = false;
      fireError(err);
      finish();
    });
    return true;
  }

  function releaseStream() {
    try { if (recStream) recStream.getTracks().forEach(t => t.stop()); } catch (_) { /* gone */ }
    recStream = null;
  }

  async function handleRecorderStop() {
    clearTimeout(recTimer);
    const blob = new Blob(recChunks, { type: (recorder && recorder.mimeType) || 'audio/webm' });
    releaseStream();
    recorder = null;
    recChunks = [];
    listening = false;
    if (discarded || !blob.size) { finish(); return; }
    transcribing = true;
    phase('transcribing');
    try {
      const data = await blobToBase64(blob);
      const text = await transcribeAudio({ data, mimeType: blob.type || 'audio/webm', lang });
      if (!discarded && text && typeof onResult === 'function') onResult(text);
    } catch (err) {
      if (!discarded) fireError(err);
    }
    transcribing = false;
    finish();
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = () => reject(new Error('Could not read the recording.'));
      reader.readAsDataURL(blob);
    });
  }

  const controller = {
    start() {
      if (listening || transcribing) return false; // robust to double-start
      if (!Ctor || preferRecorder) return beginRecorder();
      mode = 'sr';
      recognition = build();
      try {
        recognition.start();
        listening = true;
        activeDictations.add(controller);
        return true;
      } catch (err) {
        // Chromium throws InvalidStateError if start() races an existing session.
        listening = false;
        fireError(err);
        return false;
      }
    },
    stop() {
      if (mode === 'rec') {
        if (recorder && recorder.state !== 'inactive') { try { recorder.stop(); } catch (_) { /* done */ } }
        return;
      }
      if (recognition && listening) {
        try { recognition.stop(); } catch (_) { /* already stopped */ }
      }
    },
    abort() {
      if (mode === 'rec') {
        discarded = true;
        clearTimeout(recTimer);
        if (recorder && recorder.state !== 'inactive') {
          try { recorder.stop(); } catch (_) { /* done */ } // onstop sees discarded → no transcribe
        } else if (listening && !transcribing) {
          // Still waiting on the permission prompt, or nothing recording yet.
          releaseStream();
          listening = false;
          finish();
        }
        return;
      }
      if (recognition) {
        try { recognition.abort(); } catch (_) { /* already aborted */ }
      }
    },
  };
  return controller;
}

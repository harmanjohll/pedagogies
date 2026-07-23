/*
 * Co-Cher Voice Input (v7) — press-to-talk Speech-to-Text
 * =======================================================
 * A thin, honest wrapper over the Web Speech API's (webkit)SpeechRecognition.
 * The Phase-2 view agents attach this to a mic button beside a text field: the
 * teacher presses to dictate and the recognised text is surfaced back to the
 * caller. It NEVER submits, sends, or mutates anything on its own — it only
 * hands text to your callbacks (teacher-leads principle). The teacher stays in
 * control of what happens with the words.
 *
 * CAPABILITY NOTE: Web Speech recognition is effectively Chromium-only (Chrome,
 * Edge, and Chromium-based mobile browsers) and is NETWORK-BACKED — audio is
 * streamed to a remote service for transcription. It is unavailable in Firefox
 * and desktop Safari. Always gate the mic UI on isVoiceInputSupported() so
 * unsupported browsers simply never render the button.
 *
 * Pure module: no imports, no DOM beyond the recognition object it constructs.
 */

/**
 * Whether the browser exposes a (webkit)SpeechRecognition constructor.
 * Guarded for SSR/no-window (returns false).
 * @returns {boolean}
 */
export function isVoiceInputSupported() {
  return typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);
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
  if (code === 'not-allowed' || code === 'NotAllowedError' || code === 'service-not-allowed') {
    return 'Microphone access denied — allow the mic for this site in your browser settings.';
  }
  if (code === 'network') {
    return 'Voice input needs internet (speech is transcribed online) — check the connection and try again.';
  }
  if (code === 'audio-capture') {
    return 'No microphone found — check that a mic is connected and enabled.';
  }
  return 'Voice input error — please try again.';
}

/**
 * @typedef {Object} DictationOptions
 * @property {(finalText: string) => void} [onResult]   Concatenated FINAL transcript for the utterance.
 * @property {(interimText: string) => void} [onInterim] Live, not-yet-final transcript.
 * @property {(error: any) => void} [onError]           SpeechRecognition error event (or a start() failure).
 * @property {() => void} [onEnd]                       Fired once recognition ends (stop/abort or completed utterance).
 * @property {string} [lang]                            BCP-47 language tag; defaults to 'en-SG' (Singapore English).
 */

/**
 * @typedef {Object} Dictation
 * @property {() => boolean} start  Begin listening for a single press-to-talk utterance. Returns true if it started.
 * @property {() => void} stop      Stop listening but let the final result flush (fires onEnd).
 * @property {() => void} abort     Stop immediately and discard any pending result (fires onEnd).
 */

/**
 * Create a press-to-talk dictation controller.
 *
 * Configured for a single utterance: continuous = false, interimResults = true.
 * On each result event the FINAL segments are concatenated and passed to
 * onResult(text); in-progress text goes to onInterim(text). Robust to being
 * started twice — a second start() while already listening is a no-op.
 *
 * When speech input is unsupported this returns an honest no-op controller
 * (start() -> false) so callers can construct it unconditionally and rely on
 * isVoiceInputSupported() to decide whether to show the mic.
 *
 * @param {DictationOptions} [options]
 * @returns {Dictation}
 */
export function createDictation(options = {}) {
  const { onResult, onInterim, onError, onEnd, lang = 'en-SG' } = options;

  const Ctor = (typeof window !== 'undefined') &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  if (!Ctor) {
    // Unsupported: honest no-op controller. Callers should have hidden the mic.
    return {
      start() { return false; },
      stop() {},
      abort() {},
    };
  }

  let recognition = null;
  let listening = false;

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
      if (typeof onError === 'function') onError(event);
    };

    rec.onend = () => {
      listening = false;
      activeDictations.delete(controller);
      if (typeof onEnd === 'function') onEnd();
    };

    return rec;
  }

  const controller = {
    start() {
      if (listening) return false; // robust to double-start
      recognition = build();
      try {
        recognition.start();
        listening = true;
        activeDictations.add(controller);
        return true;
      } catch (err) {
        // Chromium throws InvalidStateError if start() races an existing session.
        listening = false;
        if (typeof onError === 'function') onError(err);
        return false;
      }
    },
    stop() {
      if (recognition && listening) {
        try { recognition.stop(); } catch (_) { /* already stopped */ }
      }
    },
    abort() {
      if (recognition) {
        try { recognition.abort(); } catch (_) { /* already aborted */ }
      }
    },
  };
  return controller;
}

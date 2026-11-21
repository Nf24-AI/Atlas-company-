// Browser voice: Web Speech API recognition + synthesis. Starts only on an explicit user action.
// NOTE: in Chrome/Edge, SpeechRecognition audio is processed by the browser vendor's cloud
// service. The UI asks for consent once before the first recording (see ui/office-panel.js).
export function createVoice({lang = 'ar-SA', onListening, onSpeaking, onResult, onError} = {}) {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  const stop = () => {
    if (rec) { try { rec.abort(); } catch { /* already stopped */ } rec = null; }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    onListening?.(false); onSpeaking?.(false);
  };
  return {
    canListen: Boolean(Ctor),
    canSpeak: 'speechSynthesis' in window,
    listen() {
      if (!Ctor) return false;
      stop();
      rec = new Ctor(); rec.lang = lang; rec.interimResults = false; rec.maxAlternatives = 1;
      rec.onstart = () => onListening?.(true);
      rec.onresult = e => onResult?.(e.results[0][0].transcript);
      rec.onerror = e => onError?.(e.error);
      rec.onend = () => { onListening?.(false); rec = null; };
      rec.start();
      return true;
    },
    speak(text) {
      if (!('speechSynthesis' in window) || !text) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text); u.lang = lang; u.rate = .97; u.pitch = .95;
      u.onstart = () => onSpeaking?.(true); u.onend = () => onSpeaking?.(false); u.onerror = () => onSpeaking?.(false);
      window.speechSynthesis.speak(u);
    },
    stop,
  };
}

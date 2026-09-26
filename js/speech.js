/**
 * ARTHA - Speech & Audio Synthesis Engine
 * Fixed: async voice loading, tribal phonetic TTS, mic error handling
 */

class SpeechEngine {
  constructor() {
    this.recognition = null;
    this.isRecognizing = false;
    this.audioContext = null;
    this.onResultCallback = null;
    this.onErrorCallback = null;
    this.onStateChangeCallback = null;
    this.lastTranscript = '';

    // Pre-cache voices asynchronously (Chrome returns [] on first call)
    this._voices = [];
    if ('speechSynthesis' in window) {
      const loadVoices = () => { this._voices = window.speechSynthesis.getVoices(); };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
      setTimeout(loadVoices, 500);
      setTimeout(loadVoices, 1500);
    }

    this.initRecognition();
  }

  // Recognition with user-friendly error messages
  initRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Web Speech API not supported. Use Chrome or Edge.');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = 'hi-IN';

    this.recognition.onstart = () => {
      this.isRecognizing = true;
      this.lastTranscript = '';
      if (this.onStateChangeCallback) this.onStateChangeCallback(true);
    };

    this.recognition.onresult = (event) => {
      let transcript = '';
      let isFinal = false;
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        transcript += event.results[i][0].transcript;
        if (event.results[i].isFinal) isFinal = true;
      }
      if (transcript) this.lastTranscript = transcript;
      if (this.onResultCallback && transcript) this.onResultCallback(transcript, isFinal);
    };

    this.recognition.onerror = (event) => {
      console.warn('SpeechRecognition error:', event.error);
      let userMessage = '';
      switch (event.error) {
        case 'not-allowed':
        case 'permission-denied':
          userMessage = '🎤 Microphone permission denied! Click the 🔒 icon in the browser address bar → Allow Microphone → Reload page.';
          break;
        case 'network':
          userMessage = '🌐 Network error. Speech API needs internet. Please check connection.';
          break;
        case 'no-speech':
          userMessage = '🔇 No speech detected. Please speak clearly and try again.';
          break;
        case 'service-not-allowed':
          userMessage = '⚠️ Microphone is blocked because this page was opened directly as a file. Close this tab, run "node server.js", then open http://localhost:8080 in Chrome.';
          break;
        case 'audio-capture':
          userMessage = '🎙️ No microphone found. Please connect a mic and try again.';
          break;
        default:
          userMessage = `Mic error: "${event.error}". Try serving via localhost instead of file://.`;
      }
      if (this.onErrorCallback) this.onErrorCallback(event.error, userMessage);
      this.stopRecording();
    };

    this.recognition.onend = () => {
      this.isRecognizing = false;
      if (this.lastTranscript && this.onResultCallback) this.onResultCallback(this.lastTranscript, true);
      if (this.onStateChangeCallback) this.onStateChangeCallback(false);
    };
  }

  setRecognitionLang(lang) {
    if (this.recognition) this.recognition.lang = lang;
  }

  toggleRecording() {
    if (this.isRecognizing) { this.stopRecording(); } else { this.startRecording(); }
  }

  startRecording() {
    if (!this.recognition) {
      const msg = 'Speech recognition not available. Please use Google Chrome or Microsoft Edge.';
      if (this.onErrorCallback) this.onErrorCallback('not-supported', msg);
      return;
    }
    try {
      this.recognition.start();
    } catch (err) {
      if (err.message && err.message.includes('already started')) {
        this.recognition.stop();
        setTimeout(() => { try { this.recognition.start(); } catch(e){} }, 350);
      }
    }
  }

  stopRecording() {
    if (this.recognition && this.isRecognizing) {
      try { this.recognition.stop(); } catch (err) {}
    }
    this.isRecognizing = false;
    if (this.onStateChangeCallback) this.onStateChangeCallback(false);
  }

  speak(text, lang = 'en-IN') {
    if (!('speechSynthesis' in window)) {
      this.playAcousticCue(440, 'triangle', 0.3);
      return;
    }
    window.speechSynthesis.cancel();
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    const doSpeak = () => {
      const voices = (this._voices && this._voices.length > 0) ? this._voices : window.speechSynthesis.getVoices();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.82;
      utterance.pitch = 1.05;

      let targetVoice = null;
      if (lang.startsWith('hi')) {
        targetVoice = voices.find(v => v.lang.startsWith('hi') || v.name.includes('Hindi') || v.name.includes('Swara') || v.name.includes('Madhur'))
          || voices.find(v => v.lang.includes('IN'))
          || voices.find(v => v.lang.startsWith('en'))
          || voices[0] || null;
      } else {
        targetVoice = voices.find(v => v.lang === 'en-IN' || v.lang.startsWith('en-IN') || v.name.includes('India') || v.name.includes('Neerja') || v.name.includes('Prabhat'))
          || voices.find(v => v.lang.includes('IN'))
          || voices.find(v => v.lang.startsWith('en'))
          || voices[0] || null;
      }

      if (targetVoice) {
        utterance.voice = targetVoice;
        utterance.lang = targetVoice.lang;
      } else {
        utterance.lang = lang;
      }

      window._activeSpeechUtterance = utterance;
      utterance.onstart = () => {
        if (window.avatar3D && typeof window.avatar3D.startSpeaking === 'function') {
          window.avatar3D.startSpeaking(text, 0);
        }
      };
      utterance.onend = () => {
        window._activeSpeechUtterance = null;
        if (window.avatar3D && typeof window.avatar3D.stopSpeaking === 'function') {
          window.avatar3D.stopSpeaking();
        }
      };
      utterance.onerror = (e) => {
        console.warn('Speech error:', e);
        window._activeSpeechUtterance = null;
        if (window.avatar3D && typeof window.avatar3D.stopSpeaking === 'function') {
          window.avatar3D.stopSpeaking();
        }
        this.playChildResponseSound();
      };

      try {
        window.speechSynthesis.resume();
        window.speechSynthesis.speak(utterance);
      } catch (err) {}
    };

    if (this._voices && this._voices.length > 0) {
      doSpeak();
    } else {
      const prev = window.speechSynthesis.onvoiceschanged;
      window.speechSynthesis.onvoiceschanged = () => {
        this._voices = window.speechSynthesis.getVoices();
        window.speechSynthesis.onvoiceschanged = prev;
        doSpeak();
      };
      setTimeout(() => {
        if (!this._voices || !this._voices.length) this._voices = window.speechSynthesis.getVoices();
        doSpeak();
      }, 500);
    }
  }

  /**
   * Dedicated pronunciation engine for Santhali, Ho, Mundari, Kurukh, and Kharia words.
   * Intelligently routes Devanagari to Hindi voice (when installed) OR Roman phonetics
   * to English voice so ALL devices and browsers produce audible pronunciation!
   */
  speakTribal(result, targetLang = 'santhali') {
    if (!result) return;

    if (!('speechSynthesis' in window)) {
      this.playChildResponseSound();
      return;
    }

    // Cancel any ongoing or stuck speech immediately
    try {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch (e) {}

    // 1. Gather all voices currently available
    let voices = window.speechSynthesis.getVoices();
    if ((!voices || voices.length === 0) && this._voices && this._voices.length > 0) {
      voices = this._voices;
    }

    // If voices haven't loaded yet (common in Chrome/Edge on initial click), wait for voiceschanged
    if (!voices || voices.length === 0) {
      const handleVoices = () => {
        window.speechSynthesis.removeEventListener('voiceschanged', handleVoices);
        this._voices = window.speechSynthesis.getVoices();
        this.speakTribal(result, targetLang);
      };
      window.speechSynthesis.addEventListener('voiceschanged', handleVoices);
      setTimeout(() => {
        window.speechSynthesis.removeEventListener('voiceschanged', handleVoices);
        this._voices = window.speechSynthesis.getVoices();
        if (this._voices && this._voices.length > 0) {
          this.speakTribal(result, targetLang);
        }
      }, 250);
      return;
    }

    // 2. Extract Devanagari text AND Roman phonetic text
    let devanagariText = '';
    let romanPhonetic = '';

    if (result.isAlphabet) {
      const alpha = result.alphabetEntry || (result.visual ? {
        phoneticEnglish: result.visual.phonetic,
        phoneticHindi: result.phoneticHindi,
        example: result.visual.example
      } : null);

      const pEng = (alpha && alpha.phoneticEnglish) || result.phoneticEnglish || '';
      const cleanSoundEng = pEng.split('[')[0].trim();
      const exWord = (alpha && alpha.example && alpha.example.word) ? alpha.example.word : '';

      romanPhonetic = exWord ? `${cleanSoundEng}, for ${exWord}` : cleanSoundEng;
      devanagariText = (alpha && alpha.phoneticHindi) || result.phoneticHindi || '';
    } else {
      // Classroom phrase or student response
      if (result.translations && result.translations[targetLang]) {
        const trans = result.translations[targetLang];
        devanagariText = trans.phoneticHindi || (/[\u0900-\u097F]/.test(trans.nativeScript || '') ? trans.nativeScript : '');
        romanPhonetic = trans.phoneticEnglish || '';
      }

      if (!devanagariText && result.phoneticHindi && /[\u0900-\u097F]/.test(result.phoneticHindi)) {
        devanagariText = result.phoneticHindi;
      }
      if (!devanagariText && result.nativeScript && /[\u0900-\u097F]/.test(result.nativeScript)) {
        devanagariText = result.nativeScript;
      }

      if (!romanPhonetic && result.phoneticEnglish) {
        romanPhonetic = result.phoneticEnglish;
      }
      if (!romanPhonetic && result.originalText) {
        romanPhonetic = result.originalText;
      }
    }

    // Clean up strings (strip raw tribal codepoints safely with /gu flag!)
    const cleanDevanagari = (devanagariText || '')
      .replace(/[()]/g, '')
      .replace(/[\u{118A0}-\u{118FF}\u{1C50}-\u{1C7F}\u{11DB0}-\u{11DEF}]/gu, '')
      .replace(/ᱻ|ᱼ/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const cleanRoman = (romanPhonetic || '')
      .replace(/[()]/g, '')
      .replace(/[\u{118A0}-\u{118FF}\u{1C50}-\u{1C7F}\u{11DB0}-\u{11DEF}]/gu, '')
      .replace(/[\u0900-\u097F]/g, '') // strip any Devanagari from Roman string
      .replace(/ñ/gi, 'ny')
      .replace(/ṇ/gi, 'n')
      .replace(/ṭ/gi, 't')
      .replace(/ḍ/gi, 'd')
      .replace(/ṛ/gi, 'r')
      .replace(/ᱻ|ᱼ/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // 3. Find Best Available Voice
    const hindiVoice = voices.find(v =>
      (v.lang && (v.lang.toLowerCase().startsWith('hi') || v.lang.toLowerCase() === 'hi-in')) ||
      (v.name && (v.name.includes('Hindi') || v.name.includes('Kalpana') || v.name.includes('Hemant') || v.name.includes('Swara') || v.name.includes('Madhur') || v.name.includes('Google हिन्दी')))
    );

    const indianEngVoice = voices.find(v =>
      (v.lang && (v.lang.toLowerCase() === 'en-in' || v.lang.toLowerCase().startsWith('en-in'))) ||
      (v.name && (v.name.includes('India') || v.name.includes('Neerja') || v.name.includes('Prabhat') || v.name.includes('Ravi') || v.name.includes('Heera')))
    );

    const englishVoice = indianEngVoice ||
      voices.find(v => v.lang && v.lang.toLowerCase().startsWith('en')) ||
      voices[0] || null;

    let textToSpeak = '';
    let voiceToUse = null;
    let langTag = 'en-IN';

    // 4. Decision: If a Hindi voice is installed, speak clean Devanagari text!
    // Otherwise, an English voice CANNOT speak Devanagari characters (causes silence),
    // so we speak clean Roman phonetics ("U jena ki?", "Johar gidra") with high clarity!
    if (hindiVoice && cleanDevanagari && /[\u0900-\u097F]/.test(cleanDevanagari)) {
      voiceToUse = hindiVoice;
      langTag = hindiVoice.lang || 'hi-IN';
      textToSpeak = cleanDevanagari;
    } else {
      voiceToUse = englishVoice;
      langTag = (voiceToUse && voiceToUse.lang) ? voiceToUse.lang : 'en-IN';
      textToSpeak = cleanRoman || cleanDevanagari || result.originalText || '';
    }

    if (!textToSpeak) {
      this.playChildResponseSound();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = (voiceToUse === hindiVoice) ? 0.85 : 0.80;
    utterance.pitch = 1.02;
    utterance.lang = langTag;
    if (voiceToUse) {
      utterance.voice = voiceToUse;
    }

    window._activeSpeechUtterance = utterance;
    utterance.onstart = () => {
      if (window.avatar3D && typeof window.avatar3D.startSpeaking === 'function') {
        const speechDisplay = (result && (result.phoneticEnglish || result.phoneticHindi || result.tribalScript)) || textToSpeak;
        window.avatar3D.startSpeaking(speechDisplay, 0);
      }
    };
    utterance.onend = () => {
      window._activeSpeechUtterance = null;
      if (window.avatar3D && typeof window.avatar3D.stopSpeaking === 'function') {
        window.avatar3D.stopSpeaking();
      }
    };

    utterance.onerror = (e) => {
      console.warn('[ARTHA] Tribal TTS utterance error:', e);
      window._activeSpeechUtterance = null;
      if (window.avatar3D && typeof window.avatar3D.stopSpeaking === 'function') {
        window.avatar3D.stopSpeaking();
      }
      if (textToSpeak !== cleanRoman && cleanRoman) {
        try {
          const fallbackUtterance = new SpeechSynthesisUtterance(cleanRoman);
          fallbackUtterance.rate = 0.82;
          if (englishVoice) fallbackUtterance.voice = englishVoice;
          fallbackUtterance.lang = (englishVoice && englishVoice.lang) || 'en-US';
          fallbackUtterance.onstart = () => {
            if (window.avatar3D && typeof window.avatar3D.startSpeaking === 'function') {
              window.avatar3D.startSpeaking(cleanRoman, 0);
            }
          };
          fallbackUtterance.onend = () => {
            if (window.avatar3D && typeof window.avatar3D.stopSpeaking === 'function') {
              window.avatar3D.stopSpeaking();
            }
          };
          window.speechSynthesis.speak(fallbackUtterance);
        } catch (err) {
          this.playChildResponseSound();
        }
      } else {
        this.playChildResponseSound();
      }
    };

    // Synchronous speak call ensures browser user-gesture activation is retained!
    try {
      window.speechSynthesis.resume();
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis speak exception:', err);
      this.playChildResponseSound();
    }
  }

  playAcousticCue(frequency = 520, type = 'sine', duration = 0.25) {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!this.audioContext) this.audioContext = new AudioContext();
      if (this.audioContext.state === 'suspended') this.audioContext.resume();
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
      gain.gain.setValueAtTime(0.2, this.audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.audioContext.destination);
      osc.start();
      osc.stop(this.audioContext.currentTime + duration);
    } catch (e) {}
  }

  playChildResponseSound() {
    try {
      this.playAcousticCue(523.25, 'triangle', 0.15);
      setTimeout(() => this.playAcousticCue(659.25, 'sine', 0.25), 120);
      setTimeout(() => this.playAcousticCue(783.99, 'sine', 0.35), 240);
    } catch (e) {}
  }
}

window.SpeechEngine = SpeechEngine;

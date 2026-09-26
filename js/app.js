/**
 * ARTHA (Language Bridge) - Main Application Controller
 * Handles dual-screen persona sync, live Hindi speech capture & translation,
 * flashcard rendering, student simulator, and offline mode under Jharkhand PALASH Framework.
 */

document.addEventListener('DOMContentLoaded', () => {
  // App State
  const state = {
    selectedLanguage: 'santhali', // 'santhali' | 'ho' | 'mundari'
    selectedGrade: 'class1',
    selectedSubject: 'literacy',
    isOffline: false,
    isRecording: false,
    confidenceScore: 98,
    activePhraseIndex: 0,
    activeAlphabetLetter: null,
    activePresetTab: 'phrases',
    currentHindiText: PALASH_CORPUS.phrases[0].hindi,
    activeTranslation: null,
    customTranslationText: null,
    historyLogs: []
  };

  const speechEngine = new window.SpeechEngine();

  // Global hook used by speech.js to surface voice/TTS problems visibly,
  // not just in the browser console (most people demoing this won't have
  // devtools open).
  let ttsWarningTimer = null;
  window.showTtsWarning = function (message, persistent = false) {
    const toast = document.getElementById('ttsWarningToast');
    const text = document.getElementById('ttsWarningText');
    if (!toast || !text) return;
    text.textContent = message;
    toast.classList.remove('hidden');
    toast.classList.remove('fade-scale-in');
    void toast.offsetWidth;
    toast.classList.add('fade-scale-in');
    clearTimeout(ttsWarningTimer);
    if (!persistent) {
      ttsWarningTimer = setTimeout(() => toast.classList.add('hidden'), 6000);
    }
  };

  // DOM Elements
  const elements = {
    // Language & Filter Selectors
    languageTabs: document.querySelectorAll('.lang-tab-btn'),
    gradeSelect: document.getElementById('gradeSelect'),
    subjectSelect: document.getElementById('subjectSelect'),
    languageBadge: document.getElementById('languageBadge'),

    // Microphone & Speech Elements
    micButton: document.getElementById('micButton'),
    micStatusText: document.getElementById('micStatusText'),
    transcriptionInput: document.getElementById('transcriptionInput'),
    sendTranscriptBtn: document.getElementById('sendTranscriptBtn'),
    presetChipsContainer: document.getElementById('presetChipsContainer'),
    presetTabPhrases: document.getElementById('presetTabPhrases'),
    presetTabAlphabet: document.getElementById('presetTabAlphabet'),
    alphabetChipsContainer: document.getElementById('alphabetChipsContainer'),
    alphabetGrid: document.getElementById('alphabetGrid'),
    alphabetGridSubtitle: document.getElementById('alphabetGridSubtitle'),
    openAlphabetModalBtn: document.getElementById('openAlphabetModalBtn'),
    alphabetModal: document.getElementById('alphabetModal'),
    alphabetModalTitle: document.getElementById('alphabetModalTitle'),
    alphabetModalSubtitle: document.getElementById('alphabetModalSubtitle'),
    alphabetModalScriptTh: document.getElementById('alphabetModalScriptTh'),
    alphabetModalLangPills: document.getElementById('alphabetModalLangPills'),
    closeAlphabetModalBtn: document.getElementById('closeAlphabetModalBtn'),
    closeAlphabetModalBtn2: document.getElementById('closeAlphabetModalBtn2'),
    alphabetSearchInput: document.getElementById('alphabetSearchInput'),
    alphabetTableBody: document.getElementById('alphabetTableBody'),

    // Validation Card
    confidenceBadge: document.getElementById('confidenceBadge'),
    corpusVerificationTag: document.getElementById('corpusVerificationTag'),
    editTranslationBtn: document.getElementById('editTranslationBtn'),
    validationTextarea: document.getElementById('validationTextarea'),
    broadcastBtn: document.getElementById('broadcastBtn'),

    // Offline Toggle
    offlineToggle: document.getElementById('offlineToggle'),
    offlineBanner: document.getElementById('offlineBanner'),
    connectivityStatusBadge: document.getElementById('connectivityStatusBadge'),

    // Right Screen (Classroom Display)
    flashcardContainer: document.getElementById('flashcardVisualArea'),
    flashcardTitle: document.getElementById('flashcardTitle'),
    flashcardDescription: document.getElementById('flashcardDescription'),
    classroomNativeScript: document.getElementById('classroomNativeScript'),
    classroomPhoneticEnglish: document.getElementById('classroomPhoneticEnglish'),
    classroomHindiTranslation: document.getElementById('classroomHindiTranslation'),
    classroomSpeakerBtn: document.getElementById('classroomSpeakerBtn'),
    targetScriptBadge: document.getElementById('targetScriptBadge'),

    // Student Simulator
    studentResponseGrid: document.getElementById('studentResponseGrid'),
    teacherResponseInbox: document.getElementById('teacherResponseInbox'),
    inboxEmptyState: document.getElementById('inboxEmptyState'),

    // Audio Canvas
    waveCanvas: document.getElementById('waveCanvas'),

    // Mode Switcher
    navOverviewMode: document.getElementById('navOverviewMode'),
    navLiveMode: document.getElementById('navLiveMode'),
    navPdfMode: document.getElementById('navPdfMode'),
    overviewModeSection: document.getElementById('overviewModeSection'),
    liveModeSection: document.getElementById('liveModeSection'),
    pdfModeSection: document.getElementById('pdfModeSection'),

    // PDF Translator
    pdfDropZone: document.getElementById('pdfDropZone'),
    pdfFileInput: document.getElementById('pdfFileInput'),
    pdfFileNameRow: document.getElementById('pdfFileNameRow'),
    pdfFileName: document.getElementById('pdfFileName'),
    pdfTranslateBtn: document.getElementById('pdfTranslateBtn'),
    pdfProgressRow: document.getElementById('pdfProgressRow'),
    pdfProgressText: document.getElementById('pdfProgressText'),
    pdfResultsPanel: document.getElementById('pdfResultsPanel'),
    pdfResultsSummary: document.getElementById('pdfResultsSummary'),
    pdfResultsList: document.getElementById('pdfResultsList'),
    pdfDownloadBtn: document.getElementById('pdfDownloadBtn')
  };

  const canvasCtx = elements.waveCanvas ? elements.waveCanvas.getContext('2d') : null;
  let waveAnimFrame = null;

  // Visual Assets SVGs mapping
  const flashcardSVGs = {
    books: `
      <div class="relative w-48 h-36 flex items-center justify-center">
        <svg viewBox="0 0 200 160" class="w-full h-full drop-shadow-md">
          <path d="M25 45 C50 35, 80 40, 100 50 C120 40, 150 35, 175 45 L175 125 C150 115, 120 120, 100 130 C80 120, 50 115, 25 125 Z" fill="#FAFAFA" stroke="#1B1F5E" stroke-width="4" stroke-linejoin="round" />
          <path d="M100 50 L100 130" stroke="#F97316" stroke-width="4" stroke-linecap="round" />
          <path d="M38 65 C60 58, 80 62, 92 68" stroke="#1B1F5E" stroke-width="2.5" stroke-linecap="round" />
          <path d="M38 80 C60 73, 80 77, 92 83" stroke="#1B1F5E" stroke-width="2.5" stroke-linecap="round" />
          <path d="M38 95 C60 88, 80 92, 92 98" stroke="#F97316" stroke-width="2.5" stroke-linecap="round" />
          <path d="M108 68 C120 62, 140 58, 162 65" stroke="#1B1F5E" stroke-width="2.5" stroke-linecap="round" />
          <path d="M108 83 C120 77, 140 73, 162 80" stroke="#1B1F5E" stroke-width="2.5" stroke-linecap="round" />
          <path d="M108 98 C120 92, 140 88, 162 95" stroke="#F97316" stroke-width="2.5" stroke-linecap="round" />
          <circle cx="100" cy="46" r="6" fill="#F97316" />
        </svg>
      </div>
    `,
    counting_intro: `
      <div class="relative w-48 h-36 flex items-center justify-center">
        <svg viewBox="0 0 200 160" class="w-full h-full drop-shadow-md">
          <rect x="18" y="70" width="30" height="45" rx="6" fill="#F97316" />
          <text x="33" y="100" fill="#ffffff" font-size="22" font-weight="bold" text-anchor="middle">1</text>
          
          <rect x="52" y="55" width="30" height="60" rx="6" fill="#2A2F7E" />
          <text x="67" y="92" fill="#ffffff" font-size="22" font-weight="bold" text-anchor="middle">2</text>
          
          <rect x="86" y="40" width="30" height="75" rx="6" fill="#F59E0B" />
          <text x="101" y="85" fill="#ffffff" font-size="22" font-weight="bold" text-anchor="middle">3</text>
          
          <rect x="120" y="25" width="30" height="90" rx="6" fill="#0284C7" />
          <text x="135" y="77" fill="#ffffff" font-size="22" font-weight="bold" text-anchor="middle">4</text>
          
          <rect x="154" y="12" width="30" height="103" rx="6" fill="#1B1F5E" />
          <text x="169" y="70" fill="#ffffff" font-size="22" font-weight="bold" text-anchor="middle">5</text>
        </svg>
      </div>
    `,
    five_apples: `
      <div class="relative w-56 h-40 flex items-center justify-center">
        <svg viewBox="0 0 240 140" class="w-full h-full drop-shadow-md">
          <g transform="translate(15, 40)">
            <circle cx="20" cy="30" r="18" fill="#DC2626" />
            <path d="M20 12 Q24 2, 28 8" stroke="#15803D" stroke-width="3" fill="none" stroke-linecap="round" />
            <text x="20" y="37" fill="#ffffff" font-size="18" font-weight="extrabold" text-anchor="middle">1</text>
          </g>
          <g transform="translate(58, 25)">
            <circle cx="20" cy="30" r="18" fill="#DC2626" />
            <path d="M20 12 Q24 2, 28 8" stroke="#15803D" stroke-width="3" fill="none" stroke-linecap="round" />
            <text x="20" y="37" fill="#ffffff" font-size="18" font-weight="extrabold" text-anchor="middle">2</text>
          </g>
          <g transform="translate(101, 45)">
            <circle cx="20" cy="30" r="18" fill="#DC2626" />
            <path d="M20 12 Q24 2, 28 8" stroke="#15803D" stroke-width="3" fill="none" stroke-linecap="round" />
            <text x="20" y="37" fill="#ffffff" font-size="18" font-weight="extrabold" text-anchor="middle">3</text>
          </g>
          <g transform="translate(144, 25)">
            <circle cx="20" cy="30" r="18" fill="#DC2626" />
            <path d="M20 12 Q24 2, 28 8" stroke="#15803D" stroke-width="3" fill="none" stroke-linecap="round" />
            <text x="20" y="37" fill="#ffffff" font-size="18" font-weight="extrabold" text-anchor="middle">4</text>
          </g>
          <g transform="translate(187, 40)">
            <circle cx="20" cy="30" r="18" fill="#DC2626" />
            <path d="M20 12 Q24 2, 28 8" stroke="#15803D" stroke-width="3" fill="none" stroke-linecap="round" />
            <text x="20" y="37" fill="#ffffff" font-size="18" font-weight="extrabold" text-anchor="middle">5</text>
          </g>
        </svg>
      </div>
    `,
    question: `
      <div class="relative w-44 h-36 flex items-center justify-center">
        <svg viewBox="0 0 160 140" class="w-full h-full drop-shadow-md">
          <circle cx="80" cy="70" r="55" fill="#FFF3EB" stroke="#F97316" stroke-width="4" stroke-dasharray="6,4" />
          <path d="M68 50 C68 40, 75 32, 85 32 C95 32, 102 39, 102 48 C102 60, 85 64, 85 76" fill="none" stroke="#1B1F5E" stroke-width="7" stroke-linecap="round" />
          <circle cx="85" cy="94" r="5" fill="#1B1F5E" />
        </svg>
      </div>
    `,
    celebration: `
      <div class="relative w-44 h-36 flex items-center justify-center">
        <svg viewBox="0 0 160 140" class="w-full h-full drop-shadow-md animate-bounce">
          <polygon points="80,10 98,52 144,55 108,84 120,128 80,102 40,128 52,84 16,55 62,52" fill="#F59E0B" stroke="#B45309" stroke-width="3" />
          <circle cx="80" cy="65" r="12" fill="#FFF3EB" />
          <circle cx="76" cy="63" r="2.5" fill="#1B1F5E" />
          <circle cx="84" cy="63" r="2.5" fill="#1B1F5E" />
          <path d="M75 70 Q80 75 85 70" fill="none" stroke="#1B1F5E" stroke-width="2" stroke-linecap="round" />
        </svg>
      </div>
    `,
    water: `
      <div class="relative w-44 h-36 flex items-center justify-center">
        <svg viewBox="0 0 160 140" class="w-full h-full drop-shadow-md">
          <path d="M80 20 C80 20, 45 68, 45 92 C45 112, 60 125, 80 125 C100 125, 115 112, 115 92 C115 68, 80 20, 80 20 Z" fill="#0284C7" stroke="#0369A1" stroke-width="4" />
          <path d="M68 95 C68 85, 78 75, 88 75" stroke="#BAE6FD" stroke-width="3" stroke-linecap="round" fill="none" />
        </svg>
      </div>
    `,
    alphabet: (meta) => {
      const letter = (meta && meta.letter) || 'A';
      const char = (meta && meta.char) || 'ᱚ';
      const name = (meta && meta.name && meta.name !== '—') ? meta.name : '';
      const sound = (meta && meta.phonetic) || '';
      const ex = meta && meta.example ? meta.example : null;
      const exNative = ex ? (ex.native || ex.santhali || '') : '';
      const exText = ex ? `${ex.word}${exNative ? ' (' + exNative + ')' : ''}` : `Sound: "${sound}"`;
      return `
        <div class="relative w-64 h-44 flex items-center justify-center">
          <svg viewBox="0 0 260 170" class="w-full h-full drop-shadow-md">
            <defs>
              <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#FFFDF9" />
                <stop offset="100%" stop-color="#FDF4ED" />
              </linearGradient>
              <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#1B1F5E" />
                <stop offset="100%" stop-color="#2A2F7E" />
              </linearGradient>
            </defs>
            <rect x="5" y="5" width="250" height="160" rx="20" fill="url(#cardGrad)" stroke="#1B1F5E" stroke-width="2.5" stroke-dasharray="8,4" />
            <circle cx="18" cy="18" r="3.5" fill="#F97316" />
            <circle cx="242" cy="18" r="3.5" fill="#F97316" />
            <circle cx="18" cy="152" r="3.5" fill="#F97316" />
            <circle cx="242" cy="152" r="3.5" fill="#F97316" />
            <g transform="translate(25, 25)">
              <circle cx="42" cy="50" r="38" fill="#FFF3EB" stroke="#F97316" stroke-width="3" />
              <text x="42" y="64" fill="#F97316" font-size="44" font-weight="900" font-family="Inter, sans-serif" text-anchor="middle">${letter}</text>
              <text x="42" y="104" fill="#9A3412" font-size="11" font-weight="700" text-anchor="middle">ENGLISH</text>
            </g>
            <path d="M120 75 L140 75 M135 68 L142 75 L135 82" stroke="#F97316" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
            <g transform="translate(145, 25)">
              <circle cx="42" cy="50" r="38" fill="#E8F4F0" stroke="#1B1F5E" stroke-width="3" />
              <text x="42" y="64" fill="#1B1F5E" font-size="44" font-weight="900" font-family="'Noto Sans Ol Chiki', 'Noto Sans Devanagari', 'Noto Sans', sans-serif" text-anchor="middle">${char}</text>
              <text x="42" y="104" fill="#1B1F5E" font-size="11" font-weight="700" text-anchor="middle">${name || 'TRIBAL'}</text>
            </g>
            <rect x="25" y="132" width="210" height="24" rx="12" fill="url(#badgeGrad)" />
            <text x="130" y="148" fill="#FAFAFA" font-size="10.5" font-weight="bold" font-family="Inter, sans-serif" text-anchor="middle">${exText}</text>
          </svg>
        </div>
      `;
    }
  };

  // Initialize App
  function init() {
    renderPresetChips();
    renderAlphabetGrid();
    renderStudentResponses();
    processLiveTeacherInput(state.currentHindiText, false);
    bindEvents();
    setupCanvasVisualizer();
    initAvatar3D();
  }

  // 3D Avatar AI Co-Teacher Setup & Interactive Bindings
  function initAvatar3D() {
    if (!window.Avatar3DEngine) return;

    try {
      window.avatar3D = new window.Avatar3DEngine({
        containerId: 'heroAvatarStage'
      });
      window.avatar3D.onLoaded = () => {
        const loader = document.getElementById('heroAvatarLoader');
        if (loader) loader.style.display = 'none';
      };
      window.avatar3D.init();

      // Gesture & Action Buttons
      const waveBtn = document.getElementById('avatarWaveBtn');
      if (waveBtn) {
        waveBtn.addEventListener('click', () => {
          if (window.avatar3D) window.avatar3D.wave();
          speechEngine.speak('Johar! Namaskar! I am ARTHA, your PALASH Language Co-Teacher. How can I help you today?', 'en-IN');
        });
      }

      const explainBtn = document.getElementById('avatarExplainBtn');
      if (explainBtn) {
        explainBtn.addEventListener('click', () => {
          if (window.avatar3D) window.avatar3D.explain();
          speechEngine.speak('Notice how each tribal script maps phonetically to foundational sounds! Watch the display card closely.', 'en-IN');
        });
      }

      const smileBtn = document.getElementById('avatarSmileBtn');
      if (smileBtn) {
        smileBtn.addEventListener('click', () => {
          if (window.avatar3D) window.avatar3D.cheer();
          speechEngine.speak('Excellent job! Marang bura! Keep practicing your native tribal words.', 'en-IN');
        });
      }

      const glassesBtn = document.getElementById('avatarGlassesBtn');
      if (glassesBtn) {
        glassesBtn.addEventListener('click', () => {
          if (window.avatar3D) {
            const hasGlasses = window.avatar3D.toggleGlasses();
            glassesBtn.classList.toggle('bg-orange-500', hasGlasses);
          }
        });
      }

      let currentOutfitIndex = 0;
      const outfitColors = ['emerald', 'indigo', 'palash', 'royal'];
      const outfitBtn = document.getElementById('avatarOutfitBtn');
      if (outfitBtn) {
        outfitBtn.addEventListener('click', () => {
          currentOutfitIndex = (currentOutfitIndex + 1) % outfitColors.length;
          if (window.avatar3D) {
            window.avatar3D.setOutfitColor(outfitColors[currentOutfitIndex]);
          }
        });
      }

      let currentCamIndex = 0;
      const camPresets = ['medium', 'portrait', 'full'];
      const camBtn = document.getElementById('avatarCamBtn');
      if (camBtn) {
        camBtn.addEventListener('click', () => {
          currentCamIndex = (currentCamIndex + 1) % camPresets.length;
          if (window.avatar3D) {
            window.avatar3D.applyCameraPreset(camPresets[currentCamIndex], true);
          }
        });
      }

      const talkBtn = document.getElementById('heroTalkToAvatarBtn');
      if (talkBtn) {
        talkBtn.addEventListener('click', () => {
          if (window.avatar3D) {
            window.avatar3D.wave();
            const text = 'Johar! Welcome to ARTHA. I am ARTHA, your tribal education co-pilot. Let us bridge classroom languages!';
            speechEngine.speak(text, 'en-IN');
          }
        });
      }

      const floatingDock = document.getElementById('floatingAvatarDock');
      if (floatingDock) {
        floatingDock.addEventListener('click', () => {
          if (window.avatar3D) {
            window.avatar3D.johar();
            speechEngine.speak('Johar! ARTHA here, ready to assist your tribal classroom session.', 'en-IN');
          }
        });
      }

    } catch (e) {
      console.warn('[Avatar3D] Initialization notice:', e);
    }
  }

  // Preset Mode Switcher (Phrases vs Alphabet)
  function switchPresetTab(tab) {
    state.activePresetTab = tab;
    if (tab === 'phrases') {
      if (elements.presetTabPhrases) {
        elements.presetTabPhrases.className = "px-2.5 py-1 rounded-lg font-bold text-xs bg-white text-indigo-950 shadow-2xs transition-all flex items-center gap-1.5";
      }
      if (elements.presetTabAlphabet) {
        elements.presetTabAlphabet.className = "px-2.5 py-1 rounded-lg font-bold text-xs text-gray-600 hover:text-indigo-950 transition-all flex items-center gap-1.5";
      }
      if (elements.presetChipsContainer) elements.presetChipsContainer.classList.remove('hidden');
      if (elements.alphabetChipsContainer) elements.alphabetChipsContainer.classList.add('hidden');
    } else {
      if (elements.presetTabPhrases) {
        elements.presetTabPhrases.className = "px-2.5 py-1 rounded-lg font-bold text-xs text-gray-600 hover:text-indigo-950 transition-all flex items-center gap-1.5";
      }
      if (elements.presetTabAlphabet) {
        elements.presetTabAlphabet.className = "px-2.5 py-1 rounded-lg font-bold text-xs bg-white text-indigo-950 shadow-2xs transition-all flex items-center gap-1.5";
      }
      if (elements.presetChipsContainer) elements.presetChipsContainer.classList.add('hidden');
      if (elements.alphabetChipsContainer) elements.alphabetChipsContainer.classList.remove('hidden');
      renderAlphabetGrid();
    }
  }

  // Render Alphabet A-Z Grid in Teacher Console
  function renderAlphabetGrid() {
    if (!elements.alphabetGrid || !PALASH_CORPUS.alphabets) return;
    elements.alphabetGrid.innerHTML = '';

    const langKey = state.selectedLanguage || 'santhali';
    const isSanthali = (langKey === 'santhali');
    const langInfo = (PALASH_CORPUS.metadata && PALASH_CORPUS.metadata.languages) ? PALASH_CORPUS.metadata.languages[langKey] : null;
    const langName = langInfo ? langInfo.name : langKey.toUpperCase();
    const scriptName = langInfo ? langInfo.script : 'Native';

    if (elements.alphabetGridSubtitle) {
      elements.alphabetGridSubtitle.textContent = `Tap any letter to translate into ${langName} (${scriptName}) & display:`;
    }

    PALASH_CORPUS.alphabets.forEach((alpha) => {
      const isSelected = (state.activeAlphabetLetter === alpha.letter);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `p-1.5 rounded-xl border text-center transition-all duration-150 flex flex-col items-center justify-center group ${
        isSelected
          ? 'bg-indigo-950 text-white border-indigo-950 shadow-sm scale-105 ring-2 ring-orange-500'
          : 'bg-white/90 hover:bg-indigo-50 text-indigo-950 border-gray-200 hover:border-indigo-700/40'
      }`;

      const lData = (alpha.languages && alpha.languages[langKey]) ? alpha.languages[langKey] : null;
      const displayChar = lData ? lData.char : (isSanthali ? alpha.olchiki : (alpha.devanagari || alpha.letter));
      const charName = lData ? lData.name : (alpha.olchikiName || '—');
      const soundEng = lData ? lData.phoneticEnglish : (alpha.phoneticEnglish || '');
      const fontClass = isSanthali ? 'font-olchiki' : 'font-indic';

      btn.innerHTML = `
        <span class="text-xs font-black tracking-tight ${isSelected ? 'text-orange-300' : 'text-indigo-950 group-hover:text-orange-500'}">${alpha.letter}</span>
        <span class="text-sm font-bold ${fontClass} ${isSelected ? 'text-white' : 'text-orange-500'} mt-0.5">${displayChar}</span>
      `;

      btn.title = `English: ${alpha.letter} ➔ ${langName}: ${displayChar} (${charName || '—'}) [${soundEng}]`;

      btn.addEventListener('click', () => {
        state.activeAlphabetLetter = alpha.letter;
        state.activePhraseIndex = -1;
        processLiveTeacherInput(alpha.letter, true);
        renderAlphabetGrid();
        renderPresetChips();
      });

      elements.alphabetGrid.appendChild(btn);
    });
  }

  // Render Full Alphabet Modal Table
  function renderAlphabetModalTable(filter = '') {
    if (!elements.alphabetTableBody || !PALASH_CORPUS.alphabets) return;
    elements.alphabetTableBody.innerHTML = '';

    const langKey = state.selectedLanguage || 'santhali';
    const isSanthali = (langKey === 'santhali');
    const langInfo = (PALASH_CORPUS.metadata && PALASH_CORPUS.metadata.languages) ? PALASH_CORPUS.metadata.languages[langKey] : null;
    const langName = langInfo ? langInfo.name : langKey.toUpperCase();
    const scriptName = langInfo ? langInfo.script : 'Native';

    // Update modal header & script column title
    if (elements.alphabetModalTitle) {
      elements.alphabetModalTitle.textContent = `English → ${langName} (${scriptName}) Alphabet Translator`;
    }
    if (elements.alphabetModalSubtitle) {
      elements.alphabetModalSubtitle.textContent = `Foundational Literacy • 26 English Alphabets to ${langName} Script & Phonetics`;
    }
    if (elements.alphabetModalScriptTh) {
      elements.alphabetModalScriptTh.textContent = `${langName} (${scriptName})`;
    }

    // Render language selector pills in modal
    if (elements.alphabetModalLangPills) {
      elements.alphabetModalLangPills.innerHTML = '';
      const supportedLangs = [
        { key: 'santhali', label: 'Santhali' },
        { key: 'ho', label: 'Ho' },
        { key: 'mundari', label: 'Mundari' },
        { key: 'kurukh', label: 'Kurukh' },
        { key: 'kharia', label: 'Kharia' }
      ];
      supportedLangs.forEach(item => {
        const pill = document.createElement('button');
        pill.type = 'button';
        const isActive = (state.selectedLanguage === item.key);
        pill.className = `px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
          isActive
            ? 'bg-indigo-950 text-white shadow-2xs'
            : 'bg-white text-gray-700 hover:bg-indigo-50 border border-gray-200'
        }`;
        pill.textContent = item.label;
        pill.addEventListener('click', () => {
          selectLanguage(item.key);
          renderAlphabetModalTable(elements.alphabetSearchInput ? elements.alphabetSearchInput.value : '');
        });
        elements.alphabetModalLangPills.appendChild(pill);
      });
    }

    const q = filter.trim().toLowerCase();
    const rows = PALASH_CORPUS.alphabets.filter(a => {
      const lData = (a.languages && a.languages[langKey]) ? a.languages[langKey] : null;
      const exWord = (lData && lData.example && lData.example.word) || (a.example && a.example.word) || '';
      const exNative = (lData && lData.example && (lData.example.native || lData.example.santhali)) || (a.example && a.example.santhali) || '';
      const name = (lData && lData.name) || a.olchikiName || '';
      const pEng = (lData && lData.phoneticEnglish) || a.phoneticEnglish || '';
      const pHin = (lData && lData.phoneticHindi) || a.phoneticHindi || '';

      if (!q) return true;
      return a.letter.toLowerCase().includes(q) ||
             name.toLowerCase().includes(q) ||
             pEng.toLowerCase().includes(q) ||
             pHin.toLowerCase().includes(q) ||
             exWord.toLowerCase().includes(q) ||
             exNative.toLowerCase().includes(q);
    });

    if (rows.length === 0) {
      elements.alphabetTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-8 text-gray-400 font-medium text-xs">
            No matching letters found for "${filter}".
          </td>
        </tr>
      `;
      return;
    }

    rows.forEach(a => {
      const lData = (a.languages && a.languages[langKey]) ? a.languages[langKey] : null;
      const displayChar = lData ? lData.char : (isSanthali ? a.olchiki : (a.devanagari || a.letter));
      const charName = (lData && lData.name && lData.name !== '—') ? lData.name : ((a.olchikiName && a.olchikiName !== '—') ? a.olchikiName : '—');
      const soundEng = (lData && lData.phoneticEnglish) || a.phoneticEnglish || '';
      const soundHin = (lData && lData.phoneticHindi) || a.phoneticHindi || '';
      const fontClass = isSanthali ? 'font-olchiki' : 'font-indic';
      const ex = (lData && lData.example) || a.example || null;
      const exNative = ex ? (ex.native || ex.santhali || '') : '';
      const exHtml = ex ? `<div class="font-medium text-gray-800">${ex.word}</div><div class="text-[11px] text-indigo-800 font-semibold ${fontClass}">${exNative}</div>` : '<span class="text-gray-400">—</span>';

      const tr = document.createElement('tr');
      tr.className = "hover:bg-orange-50/50 transition-colors";
      tr.innerHTML = `
        <td class="py-3 px-3">
          <div class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#FFF3EB] border border-orange-500/30 text-sm font-black text-orange-500">
            ${a.letter}
          </div>
        </td>
        <td class="py-3 px-3">
          <span class="text-2xl font-bold ${fontClass} text-indigo-950">
            ${displayChar}
          </span>
        </td>
        <td class="py-3 px-3 font-semibold text-gray-700">
          ${charName !== '—' ? charName : '<span class="text-gray-400">—</span>'}
        </td>
        <td class="py-3 px-3">
          <div class="font-medium text-gray-800">${soundEng}</div>
          <div class="text-[11px] text-gray-500">${soundHin}</div>
        </td>
        <td class="py-3 px-3">
          ${exHtml}
        </td>
        <td class="py-3 px-3 text-right">
          <div class="inline-flex items-center gap-1.5">
            <button type="button" class="alphabet-table-speak-btn p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer" title="Pronounce sound">
              <i data-lucide="volume-2" class="w-3.5 h-3.5"></i>
            </button>
            <button type="button" class="alphabet-table-use-btn px-3 py-1.5 rounded-lg bg-indigo-950 hover:bg-[#2A2F7E] text-white text-[11px] font-bold shadow-2xs transition-all flex items-center gap-1 cursor-pointer">
              <span>Display</span>
              <i data-lucide="arrow-right" class="w-3 h-3 text-orange-300"></i>
            </button>
          </div>
        </td>
      `;

      const speakBtn = tr.querySelector('.alphabet-table-speak-btn');
      if (speakBtn) {
        speakBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const targetLang = state.selectedLanguage;
          const trans = window.PALASH_TRANSLATOR.translateLive(a.letter, targetLang);
          speechEngine.speakTribal(trans, targetLang);
        });
      }

      const useBtn = tr.querySelector('.alphabet-table-use-btn');
      if (useBtn) {
        useBtn.addEventListener('click', () => {
          state.activeAlphabetLetter = a.letter;
          state.activePhraseIndex = -1;
          processLiveTeacherInput(a.letter, true);
          if (elements.alphabetModal) {
            elements.alphabetModal.classList.add('hidden');
          }
          switchPresetTab('alphabet');
        });
      }

      elements.alphabetTableBody.appendChild(tr);
    });

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  // Render Preset Suggestion Chips in English
  function renderPresetChips() {
    if (!elements.presetChipsContainer) return;
    elements.presetChipsContainer.innerHTML = '';

    PALASH_CORPUS.phrases.forEach((phrase, idx) => {
      const isSelected = (state.activePhraseIndex === idx);
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `text-xs px-3 py-2 rounded-xl text-left border transition-all duration-200 flex items-center space-x-2 ${
        isSelected
          ? 'bg-indigo-950 text-white border-indigo-950 shadow-sm'
          : 'bg-white/80 hover:bg-indigo-50 text-indigo-950 border-indigo-900/15'
      }`;
      chip.innerHTML = `
        <span class="w-2 h-2 rounded-full ${isSelected ? 'bg-orange-500' : 'bg-indigo-700/40'}"></span>
        <span class="truncate font-medium">${phrase.english}</span>
      `;
      chip.addEventListener('click', () => {
        state.activePhraseIndex = idx;
        state.activeAlphabetLetter = null;
        // Use the Hindi text (not English) -- processLiveTeacherInput expects
        // Hindi, and the real Mundari engine only understands Hindi input.
        processLiveTeacherInput(phrase.hindi, true);
        renderAlphabetGrid();
      });
      elements.presetChipsContainer.appendChild(chip);
    });
  }

  // Render Student Response Buttons in Classroom Display
  function renderStudentResponses() {
    if (!elements.studentResponseGrid) return;
    elements.studentResponseGrid.innerHTML = '';

    PALASH_CORPUS.studentResponses.forEach((resp) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `p-3 rounded-2xl border text-left transition-all duration-200 shadow-sm hover:shadow-md transform active:scale-95 bg-white border-indigo-900/10 hover:border-orange-500 group relative overflow-hidden`;

      const dialectText = resp[state.selectedLanguage] || resp.santhali;

      btn.innerHTML = `
        <div class="flex items-start space-x-3">
          <div class="w-9 h-9 rounded-xl bg-[#FFF3EB] group-hover:bg-orange-500 text-orange-500 group-hover:text-white flex items-center justify-center flex-shrink-0 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-xs font-semibold text-indigo-950 group-hover:text-orange-500 truncate">
              ${resp.englishMeaning}
            </div>
            <div class="text-[11px] text-gray-500 font-olchiki truncate mt-0.5">
              ${dialectText}
            </div>
          </div>
        </div>
      `;

      btn.addEventListener('click', () => {
        handleStudentResponseClick(resp);
      });

      elements.studentResponseGrid.appendChild(btn);
    });
  }

  // Handle Student Response Click (Simulating 2-way communication)
  function handleStudentResponseClick(resp) {
    speechEngine.playChildResponseSound();

    const dialectText = resp[state.selectedLanguage] || resp.santhali;
    const match = dialectText.match(/\(([^)]+)\)/);
    const phonetic = match ? match[1] : dialectText;

    // Add to Teacher Inbox
    addTeacherNotification({
      childText: dialectText,
      hindiMeaning: resp.hindiMeaning,
      englishMeaning: resp.englishMeaning,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      type: resp.type
    });

    // Speak the student's tribal pronunciation
    speechEngine.speakTribal({ phoneticEnglish: phonetic, phoneticHindi: resp.hindiMeaning, originalText: phonetic }, state.selectedLanguage);
  }

  // Add notification to Teacher Co-Pilot screen in Hindi
  function addTeacherNotification(item) {
    if (elements.inboxEmptyState) {
      elements.inboxEmptyState.classList.add('hidden');
    }

    const alertCard = document.createElement('div');
    alertCard.className = `p-3.5 rounded-2xl border border-orange-500/30 bg-[#FFF3EB] shadow-sm transition-all duration-300 transform translate-y-[-8px] opacity-0 animate-slide-down incoming-alert`;

    alertCard.innerHTML = `
      <div class="flex items-center justify-between mb-1.5">
        <span class="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-500 text-white">
          <svg class="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>New Student Response</span>
        </span>
        <span class="text-[10px] text-gray-500">${item.timestamp}</span>
      </div>
      <div class="text-xs font-semibold text-indigo-950 mb-1">
        Translation: "${item.hindiMeaning}" (${item.englishMeaning})
      </div>
      <div class="text-[11px] text-[#9A3412] font-olchiki bg-white/70 px-2 py-1 rounded-lg border border-orange-200">
        Spoken sound: "${item.childText}"
      </div>
    `;

    if (elements.teacherResponseInbox) {
      elements.teacherResponseInbox.insertBefore(alertCard, elements.teacherResponseInbox.firstChild);
      setTimeout(() => {
        alertCard.classList.remove('translate-y-[-8px]', 'opacity-0');
      }, 10);
    }
  }

  /**
   * CORE LIVE TRANSLATION DISPATCHER
   * Converts ANY spoken or typed Hindi into Santhali, Ho, or Mundari in real-time,
   * without reverting or losing the user's spoken words!
   */
  function processLiveTeacherInput(hindiText, autoPlay = false) {
    if (!hindiText || !hindiText.trim()) return;

    const cleanInput = hindiText.trim();
    state.currentHindiText = cleanInput;
    state.customTranslationText = null;

    // Preserve the user's spoken input in the text box
    if (elements.transcriptionInput && elements.transcriptionInput.value !== cleanInput) {
      elements.transcriptionInput.value = cleanInput;
    }

    // Translate via PALASH_TRANSLATOR
    const targetLang = state.selectedLanguage;
    const translationResult = window.PALASH_TRANSLATOR.translateLive(cleanInput, targetLang);

    if (!translationResult) return;

    state.activeTranslation = translationResult;
    state.confidenceScore = translationResult.confidence;

    // Check if this matches a known preset phrase to highlight its chip
    const cleanLower = cleanInput.toLowerCase().replace(/[.,!?;:'"।\-]/g, '').trim();
    const matchedIdx = PALASH_CORPUS.phrases.findIndex(p => {
      const hinClean = (p.hindi || '').toLowerCase().replace(/[.,!?;:'"।\-]/g, '').trim();
      const engClean = (p.english || '').toLowerCase().replace(/[.,!?;:'"।\-]/g, '').trim();
      return cleanLower === hinClean || cleanLower.includes(hinClean) || (cleanLower.length >= 3 && hinClean.includes(cleanLower)) ||
             cleanLower === engClean || cleanLower.includes(engClean) || (cleanLower.length >= 3 && engClean.includes(cleanLower));
    });
    state.activePhraseIndex = matchedIdx;

    // Update UI components
    updateValidationCard();
    updateClassroomDisplay();
    renderPresetChips();

    if (autoPlay) {
      playCurrentClassroomSpeech();
    }
  }

  // Update Validation Card on Teacher Screen
  function updateValidationCard() {
    if (!state.activeTranslation) return;
    const result = state.activeTranslation;

    if (elements.confidenceBadge) {
      elements.confidenceBadge.textContent = result.isDataUnavailable ? 'No data' : `${result.confidence}% Confidence`;
      const badgeIsHigh = result.confidence >= 85;
      elements.confidenceBadge.className = result.isDataUnavailable
        ? 'px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-gray-100 text-gray-500 border border-gray-300'
        : (badgeIsHigh
          ? 'px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-300'
          : 'px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-orange-100 text-orange-800 border border-orange-300');
    }

    if (elements.corpusVerificationTag) {
      elements.corpusVerificationTag.textContent = result.verificationTag;
      elements.corpusVerificationTag.className = result.isDataUnavailable
        ? 'text-orange-700 font-medium'
        : (result.isRealData ? 'text-indigo-800 font-medium' : 'text-gray-500 font-medium');
    }

    if (elements.validationTextarea) {
      const displayText = result.isDataUnavailable ? '' : (state.customTranslationText || result.nativeScript);
      elements.validationTextarea.value = displayText;
      elements.validationTextarea.placeholder = result.isDataUnavailable
        ? 'No translation data available for this language yet.'
        : '';
    }

    renderConfidenceMeter(result);

    if (!result.isDataUnavailable && result.isRealData && result.method === 'corpus_match') {
      launchConfetti();
    }
  }

  // Inject (once) a confidence meter bar right under the confidence badge
  function renderConfidenceMeter(result) {
    let meter = document.getElementById('confidenceMeterTrack');
    if (!meter) {
      const host = elements.confidenceBadge ? elements.confidenceBadge.closest('.flex.items-center.justify-between') : null;
      if (!host) return;
      const wrap = document.createElement('div');
      wrap.className = 'confidence-meter-track w-full mt-2';
      wrap.innerHTML = '<div id="confidenceMeterFill" class="confidence-meter-fill"></div>';
      host.insertAdjacentElement('afterend', wrap);
      meter = wrap;
    }
    const fill = document.getElementById('confidenceMeterFill');
    if (fill) {
      fill.style.width = `${Math.max(4, result.confidence)}%`;
      fill.style.backgroundColor = result.isDataUnavailable
        ? '#9CA3AF'
        : (result.confidence >= 85 ? '#16A34A' : (result.confidence >= 60 ? '#F97316' : '#DC2626'));
    }
  }

  // Lightweight CSS confetti burst -- purely celebratory, triggers on a
  // genuine high-confidence real-corpus match (never on approximate output)
  function launchConfetti() {
    const host = elements.confidenceBadge;
    if (!host) return;
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '0';
    container.style.top = '0';
    container.style.width = '100%';
    container.style.height = '0';
    container.style.overflow = 'visible';
    container.style.pointerEvents = 'none';
    const colors = ['#F97316', '#1B1F5E', '#F59E0B', '#16A34A'];
    for (let i = 0; i < 14; i++) {
      const piece = document.createElement('span');
      piece.className = 'confetti-piece';
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = `${Math.random() * 0.2}s`;
      container.appendChild(piece);
    }
    const relTarget = host.closest('.glass-panel');
    if (relTarget) {
      relTarget.style.position = 'relative';
      relTarget.appendChild(container);
      setTimeout(() => container.remove(), 1700);
    }
  }

  // Update Right Screen (Classroom Display)
  function updateClassroomDisplay() {
    if (!state.activeTranslation) return;
    const result = state.activeTranslation;
    const langKey = state.selectedLanguage;
    const langInfo = PALASH_CORPUS.metadata.languages[langKey];

    // Visual Flashcard
    if (elements.flashcardContainer) {
      const visualType = (result.visual && result.visual.type) ? result.visual.type : 'books';
      elements.flashcardContainer.innerHTML = flashcardSVGs[visualType] || flashcardSVGs.books;
    }

    if (elements.flashcardTitle) {
      elements.flashcardTitle.textContent = result.visual ? result.visual.title : 'कक्षा अधिगम | Learning';
    }

    if (elements.flashcardDescription) {
      elements.flashcardDescription.textContent = result.visual ? result.visual.description : 'झारखंड पलाश ढांचा आधारित प्राथमिक शिक्षा';
    }

    // Scripts
    if (elements.classroomNativeScript) {
      if (result.isDataUnavailable) {
        elements.classroomNativeScript.textContent = `⚠ No ${langInfo.name} translation data available yet`;
        elements.classroomNativeScript.className = "text-lg md:text-xl font-bold text-orange-700 leading-relaxed";
      } else {
        const displayText = state.customTranslationText || result.nativeScript;
        elements.classroomNativeScript.textContent = displayText;

        if (langKey === 'santhali') {
          elements.classroomNativeScript.className = "text-2xl md:text-4xl font-extrabold text-indigo-950 tracking-wide font-olchiki leading-relaxed";
        } else {
          elements.classroomNativeScript.className = "text-2xl md:text-3xl font-extrabold text-indigo-950 tracking-wide font-indic leading-relaxed";
        }
      }
    }

    if (elements.classroomPhoneticEnglish) {
      elements.classroomPhoneticEnglish.textContent = result.isDataUnavailable
        ? (langInfo.dataSource || 'This language needs community seed data before it can be translated.')
        : `Pronunciation: "${result.phoneticEnglish}"`;
    }

    if (elements.classroomHindiTranslation) {
      elements.classroomHindiTranslation.textContent = `हिन्दी अर्थ: "${result.hindiMeaning || result.originalText}"`;
    }

    if (elements.targetScriptBadge) {
      elements.targetScriptBadge.textContent = `${langInfo.name} (${langInfo.script})`;
    }

    if (elements.languageBadge) {
      elements.languageBadge.textContent = `${langInfo.nativeName} (${langInfo.name})`;
    }



    // Refresh student response buttons text for the chosen language
    renderStudentResponses();
  }

  // Speak Current Phrase in tribal language (Santhali, Ho, or Mundari)
  function playCurrentClassroomSpeech() {
    if (!state.activeTranslation) return;
    const result = state.activeTranslation;

    // Animate speaker button
    if (elements.classroomSpeakerBtn) {
      elements.classroomSpeakerBtn.classList.add('scale-110', 'ring-4', 'ring-orange-500');
      setTimeout(() => {
        elements.classroomSpeakerBtn.classList.remove('scale-110', 'ring-4', 'ring-orange-500');
      }, 500);
    }

    // Animate 3D avatar co-teacher
    if (window.avatar3D) {
      window.avatar3D.explain();
    }

    // Speak using dedicated tribal pronunciation engine
    speechEngine.speakTribal(result, state.selectedLanguage);
  }

  // Setup Canvas Wave Visualizer
  function setupCanvasVisualizer() {
    if (!elements.waveCanvas || !canvasCtx) return;
    const canvas = elements.waveCanvas;

    function resize() {
      canvas.width = canvas.parentElement.clientWidth || 300;
      canvas.height = 40;
    }
    resize();
    window.addEventListener('resize', resize);

    // Cross-browser polyfill for roundRect (not available in older browsers)
    function drawRoundedBar(ctx, x, y, w, h, r) {
      if (h < 2 * r) r = h / 2;
      if (w < 2 * r) r = w / 2;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y,     x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x,     y + h, r);
      ctx.arcTo(x,     y + h, x,     y,     r);
      ctx.arcTo(x,     y,     x + w, y,     r);
      ctx.closePath();
    }

    let phase = 0;
    function renderWave() {
      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
      const isLive = state.isRecording;

      const numBars = 28;
      const barWidth = 4;
      const spacing = Math.max(1, (canvas.width - (numBars * barWidth)) / (numBars - 1));

      for (let i = 0; i < numBars; i++) {
        const x = i * (barWidth + spacing);
        let height = 4;
        if (isLive) {
          const freq = Math.sin(phase + i * 0.35) * Math.cos(phase * 0.8 + i * 0.2);
          height = Math.max(4, Math.abs(freq) * 32);
        } else {
          height = Math.sin(phase * 0.4 + i * 0.2) * 3 + 5;
        }

        const y = (canvas.height - height) / 2;
        canvasCtx.fillStyle = isLive ? '#F97316' : '#2A2F7E';
        drawRoundedBar(canvasCtx, x, y, barWidth, height, 2);
        canvasCtx.fill();
      }

      phase += isLive ? 0.15 : 0.03;
      waveAnimFrame = requestAnimationFrame(renderWave);
    }

    renderWave();
  }

  // Change Active Language and Refresh UI
  function selectLanguage(lang) {
    if (!lang) return;
    state.selectedLanguage = lang;

    elements.languageTabs.forEach(t => {
      const tLang = t.getAttribute('data-lang');
      const isCurrent = (tLang === lang);
      t.classList.remove('bg-indigo-950', 'text-white', 'shadow-sm', 'bg-white/70', 'text-gray-700', 'hover:bg-indigo-50', 'ring-2', 'ring-orange-500', 'bg-orange-100', 'bg-orange-50/60', 'text-orange-800');
      if (isCurrent) {
        t.classList.add('bg-indigo-950', 'text-white', 'shadow-sm');
      } else {
        t.classList.add('bg-white/70', 'text-gray-700', 'hover:bg-indigo-50');
      }
    });

    renderAlphabetGrid();
    renderStudentResponses();
    // Immediately re-translate current phrase into newly chosen language and pronounce!
    processLiveTeacherInput(state.currentHindiText, true);
  }

  // Bind All Events
  function bindEvents() {
    // Language Tab Switching
    elements.languageTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const lang = tab.getAttribute('data-lang');
        selectLanguage(lang);
      });
    });

    // Grade and Subject Selectors
    if (elements.gradeSelect) {
      elements.gradeSelect.addEventListener('change', (e) => {
        state.selectedGrade = e.target.value;
      });
    }

    if (elements.subjectSelect) {
      elements.subjectSelect.addEventListener('change', (e) => {
        state.selectedSubject = e.target.value;
        const matched = PALASH_CORPUS.phrases.find(p => p.subject === state.selectedSubject);
        if (matched) {
          processLiveTeacherInput(matched.hindi, true);
        }
      });
    }

    // Microphone Toggle
    if (elements.micButton) {
      elements.micButton.addEventListener('click', async () => {
        if (state.isRecording) {
          speechEngine.stopRecording();
          setRecordingState(false);
          return;
        }

        // Explicitly request mic permission first -- on some browsers
        // (notably Edge) SpeechRecognition alone doesn't reliably trigger
        // the permission prompt, and this also gives us a clear reason
        // if it's denied instead of a silent failure.
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(t => t.stop()); // we only needed the permission grant
          } catch (permErr) {
            console.warn('Mic permission error:', permErr);
            let msg = '🎤 Microphone access denied or unavailable.';
            if (permErr.name === 'NotAllowedError' || permErr.name === 'PermissionDeniedError') {
              msg = '🎤 Microphone permission denied. Click the 🔒/ⓘ icon in the address bar → Allow Microphone → reload the page.';
            } else if (permErr.name === 'NotFoundError') {
              msg = '🎙️ No microphone found on this device.';
            } else if (window.location.protocol === 'file:') {
              msg = '⚠️ This page was opened as a file (file://). The mic needs a real server: run "node server.js" in the project folder, then open http://localhost:8080.';
            }
            if (elements.micStatusText) {
              elements.micStatusText.textContent = msg;
              elements.micStatusText.className = 'text-[11px] font-semibold text-red-600';
            }
            if (window.showTtsWarning) window.showTtsWarning(msg);
            return;
          }
        }

        speechEngine.startRecording();
        setRecordingState(true);
      });
    }

    // Speech Engine Callbacks
    speechEngine.onStateChangeCallback = (isRecording) => {
      setRecordingState(isRecording);
    };

    speechEngine.onErrorCallback = (err, userMessage) => {
      console.warn('Speech Engine Error:', err);
      if (elements.micStatusText) {
        elements.micStatusText.textContent = userMessage || 'Mic unavailable. Type in box or select preset.';
        elements.micStatusText.className = 'text-[11px] font-semibold text-orange-600 animate-pulse';
        setTimeout(() => {
          if (elements.micStatusText) {
            elements.micStatusText.textContent = 'Click mic to speak';
            elements.micStatusText.className = 'text-[11px] font-medium text-gray-500';
          }
        }, 6000);
      }
      setRecordingState(false);
    };

    speechEngine.onResultCallback = (transcript, isFinal) => {
      if (!transcript || !transcript.trim()) return;

      // Update input box with spoken text in real-time
      if (elements.transcriptionInput) {
        elements.transcriptionInput.value = transcript;
      }

      // If speech is finalized or recognized, translate live and speak in tribal language!
      if (isFinal) {
        processLiveTeacherInput(transcript, true);
        setRecordingState(false);
      }
    };

    // Manual transcription submit button (command line input)
    if (elements.sendTranscriptBtn) {
      elements.sendTranscriptBtn.addEventListener('click', () => {
        const text = elements.transcriptionInput ? elements.transcriptionInput.value : '';
        processLiveTeacherInput(text, true);
      });
    }

    if (elements.transcriptionInput) {
      elements.transcriptionInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          processLiveTeacherInput(elements.transcriptionInput.value, true);
        }
      });
    }

    // Edit Translation Toggle
    if (elements.editTranslationBtn) {
      elements.editTranslationBtn.addEventListener('click', () => {
        if (elements.validationTextarea) {
          elements.validationTextarea.removeAttribute('readonly');
          elements.validationTextarea.focus();
          elements.editTranslationBtn.innerHTML = `
            <svg class="w-3.5 h-3.5 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
            <span class="text-indigo-800 font-semibold">Done</span>
          `;
        }
      });
    }

    if (elements.validationTextarea) {
      elements.validationTextarea.addEventListener('input', (e) => {
        state.customTranslationText = e.target.value;
      });
    }

    // Broadcast to Classroom button
    if (elements.broadcastBtn) {
      elements.broadcastBtn.addEventListener('click', () => {
        updateClassroomDisplay();
        playCurrentClassroomSpeech();
      });
    }

    // Classroom Speaker Audio Playback
    if (elements.classroomSpeakerBtn) {
      elements.classroomSpeakerBtn.addEventListener('click', () => {
        playCurrentClassroomSpeech();
      });
    }

    // Offline Mode Simulator Toggle
    if (elements.offlineToggle) {
      elements.offlineToggle.addEventListener('change', (e) => {
        state.isOffline = e.target.checked;
        toggleOfflineMode(state.isOffline);
      });
    }

    // Mode Switcher: Overview <-> Live Classroom <-> PDF Translator
    if (elements.navOverviewMode) {
      elements.navOverviewMode.addEventListener('click', () => setAppMode('overview'));
    }
    if (elements.navLiveMode) {
      elements.navLiveMode.addEventListener('click', () => setAppMode('live'));
    }
    if (elements.navPdfMode) {
      elements.navPdfMode.addEventListener('click', () => setAppMode('pdf'));
    }

    // Overview page CTA buttons ("Open Live Classroom Console" / "Try the PDF Translator")
    document.querySelectorAll('[data-jump]').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-jump'); // 'live' or 'pdf'
        setAppMode(target);
      });
    });

    // Preset Mode Toggle (Phrases vs Alphabet)
    if (elements.presetTabPhrases) {
      elements.presetTabPhrases.addEventListener('click', () => switchPresetTab('phrases'));
    }
    if (elements.presetTabAlphabet) {
      elements.presetTabAlphabet.addEventListener('click', () => switchPresetTab('alphabet'));
    }

    // Alphabet Modal Open / Close / Search
    if (elements.openAlphabetModalBtn) {
      elements.openAlphabetModalBtn.addEventListener('click', () => {
        if (elements.alphabetModal) {
          renderAlphabetModalTable(elements.alphabetSearchInput ? elements.alphabetSearchInput.value : '');
          elements.alphabetModal.classList.remove('hidden');
        }
      });
    }
    if (elements.closeAlphabetModalBtn) {
      elements.closeAlphabetModalBtn.addEventListener('click', () => {
        if (elements.alphabetModal) elements.alphabetModal.classList.add('hidden');
      });
    }
    if (elements.closeAlphabetModalBtn2) {
      elements.closeAlphabetModalBtn2.addEventListener('click', () => {
        if (elements.alphabetModal) elements.alphabetModal.classList.add('hidden');
      });
    }
    if (elements.alphabetModal) {
      elements.alphabetModal.addEventListener('click', (e) => {
        if (e.target === elements.alphabetModal) {
          elements.alphabetModal.classList.add('hidden');
        }
      });
    }
    if (elements.alphabetSearchInput) {
      elements.alphabetSearchInput.addEventListener('input', (e) => {
        renderAlphabetModalTable(e.target.value);
      });
    }

    bindPdfTranslatorEvents();
  }

  // ===================================================================
  // MODE SWITCHER
  // ===================================================================
  function setAppMode(mode) {
    const sections = { overview: elements.overviewModeSection, live: elements.liveModeSection, pdf: elements.pdfModeSection };
    const navButtons = { overview: elements.navOverviewMode, live: elements.navLiveMode, pdf: elements.navPdfMode };

    Object.keys(sections).forEach(key => {
      if (sections[key]) sections[key].classList.toggle('hidden', key !== mode);
      if (navButtons[key]) navButtons[key].classList.toggle('active', key === mode);
    });

    const target = sections[mode];
    if (target) {
      target.classList.remove('fade-scale-in');
      void target.offsetWidth; // restart animation
      target.classList.add('fade-scale-in');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // ===================================================================
  // PDF TRANSLATOR (Hindi PDF -> Mundari PDF, real corpus + lexicon)
  // ===================================================================
  let selectedPdfFile = null;

  function bindPdfTranslatorEvents() {
    if (elements.pdfDropZone && elements.pdfFileInput) {
      elements.pdfDropZone.addEventListener('click', () => elements.pdfFileInput.click());

      elements.pdfDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.pdfDropZone.classList.add('drag-active');
      });
      elements.pdfDropZone.addEventListener('dragleave', () => {
        elements.pdfDropZone.classList.remove('drag-active');
      });
      elements.pdfDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.pdfDropZone.classList.remove('drag-active');
        const file = e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) handlePdfFileSelected(file);
      });

      elements.pdfFileInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) handlePdfFileSelected(file);
      });
    }

    if (elements.pdfTranslateBtn) {
      elements.pdfTranslateBtn.addEventListener('click', runPdfTranslation);
    }

    if (elements.pdfDownloadBtn) {
      elements.pdfDownloadBtn.addEventListener('click', downloadTranslatedPdf);
    }
  }

  function handlePdfFileSelected(file) {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      alert('Please choose a PDF file.');
      return;
    }
    selectedPdfFile = file;
    if (elements.pdfFileName) elements.pdfFileName.textContent = file.name;
    if (elements.pdfFileNameRow) elements.pdfFileNameRow.classList.remove('hidden');
    if (elements.pdfResultsPanel) elements.pdfResultsPanel.classList.add('hidden');
  }

  let lastPdfResults = null;

  async function runPdfTranslation() {
    if (!selectedPdfFile) return;
    if (!window.MUNDARI_ENGINE || !window.MUNDARI_ENGINE.isReady()) {
      alert('Translation data is still loading -- please wait a moment and try again.');
      return;
    }

    if (elements.pdfProgressRow) elements.pdfProgressRow.classList.remove('hidden');
    if (elements.pdfResultsPanel) elements.pdfResultsPanel.classList.add('hidden');
    if (elements.pdfProgressText) elements.pdfProgressText.textContent = 'Reading PDF…';

    try {
      const text = await window.PDF_TRANSLATOR.extractTextFromPdf(selectedPdfFile, (page, total) => {
        if (elements.pdfProgressText) elements.pdfProgressText.textContent = `Reading PDF… page ${page}/${total}`;
      });

      if (elements.pdfProgressText) elements.pdfProgressText.textContent = 'Translating sentences using the real corpus + lexicon…';
      await new Promise(r => setTimeout(r, 60)); // let the UI paint before the sync loop below

      const results = window.PDF_TRANSLATOR.translateExtractedText(text);
      lastPdfResults = results;
      renderPdfResults(results);
    } catch (err) {
      console.error(err);
      alert('Could not read that PDF. It may be a scanned/image PDF (needs OCR, not included in this prototype), or a corrupted file.');
    } finally {
      if (elements.pdfProgressRow) elements.pdfProgressRow.classList.add('hidden');
    }
  }

  function renderPdfResults(results) {
    if (!elements.pdfResultsList) return;
    elements.pdfResultsList.innerHTML = '';

    const corpusMatches = results.filter(r => r.method === 'corpus_match').length;
    const avgConfidence = results.length
      ? Math.round(results.reduce((s, r) => s + r.confidence, 0) / results.length)
      : 0;

    if (elements.pdfResultsSummary) {
      elements.pdfResultsSummary.textContent =
        `${results.length} sentences · ${corpusMatches} high-confidence corpus matches · ~${avgConfidence}% average confidence`;
    }

    results.forEach((r, idx) => {
      const isHigh = r.method === 'corpus_match';
      const card = document.createElement('div');
      card.className = `fade-scale-in p-3.5 rounded-2xl border ${isHigh ? 'border-indigo-200 bg-indigo-50/50' : 'border-orange-200 bg-orange-50/40'}`;
      card.style.animationDelay = `${Math.min(idx * 0.02, 0.4)}s`;
      card.innerHTML = `
        <div class="text-xs font-semibold text-indigo-950">${idx + 1}. ${escapeHtml(r.source)}</div>
        <div class="text-sm font-bold ${isHigh ? 'text-indigo-800' : 'text-orange-800'} font-indic mt-1">${escapeHtml(r.nativeScript)}</div>
        <div class="flex items-center justify-between mt-1.5">
          <span class="text-[10px] font-medium ${isHigh ? 'text-indigo-700' : 'text-orange-700'}">${r.verificationTag} · ${r.confidence}%</span>
          ${r.unknownWords && r.unknownWords.length ? `<span class="text-[10px] text-orange-600">\u26a0 ${r.unknownWords.length} untranslated</span>` : ''}
        </div>
      `;
      elements.pdfResultsList.appendChild(card);
    });

    if (elements.pdfResultsPanel) elements.pdfResultsPanel.classList.remove('hidden');
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function downloadTranslatedPdf() {
    if (!lastPdfResults || !lastPdfResults.length) return;
    try {
      window.PDF_TRANSLATOR.buildOutputPdf(lastPdfResults, selectedPdfFile ? selectedPdfFile.name : 'document.pdf');
    } catch (err) {
      console.error(err);
      alert('Could not generate the PDF. Check the browser console for details.');
    }
  }

  function setRecordingState(isRec) {
    state.isRecording = isRec;
    if (elements.micButton) {
      if (isRec) {
        elements.micButton.classList.add('mic-recording');
        if (elements.micStatusText) elements.micStatusText.textContent = 'Listening... Speak now';
      } else {
        elements.micButton.classList.remove('mic-recording');
        if (elements.micStatusText) elements.micStatusText.textContent = 'Click mic to speak';
      }
    }
  }

  function toggleOfflineMode(isOffline) {
    if (isOffline) {
      if (elements.offlineBanner) {
        elements.offlineBanner.classList.remove('hidden');
      }
      if (elements.connectivityStatusBadge) {
        elements.connectivityStatusBadge.innerHTML = `
          <span class="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse"></span>
          <span class="text-orange-800 font-medium">Offline (Edge Cached)</span>
        `;
        elements.connectivityStatusBadge.className = "flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs bg-orange-100/90 border border-orange-300";
      }
    } else {
      if (elements.offlineBanner) {
        elements.offlineBanner.classList.add('hidden');
      }
      if (elements.connectivityStatusBadge) {
        elements.connectivityStatusBadge.innerHTML = `
          <span class="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
          <span class="text-indigo-900 font-medium">Online (Active)</span>
        `;
        elements.connectivityStatusBadge.className = "flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs bg-indigo-100/90 border border-indigo-300";
      }
    }
  }

  // Start app
  init();
});



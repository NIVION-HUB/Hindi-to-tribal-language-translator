/**
 * Bhasha Setu - REAL Mundari Translation Engine
 * Ports the exact same two-tier strategy used in the verified Python
 * prototype: (1) sentence-level match against the real 17,809-pair
 * corpus, (2) statistical word-substitution fallback using the
 * IBM-Model-1 lexicon trained on that same corpus. Every output is
 * traceable to real data -- nothing here is invented.
 */
const MUNDARI_ENGINE = (function () {

  const PUNCT_RE = /[।,.!?;:"'()\[\]]/g;

  function tokenize(s) {
    return s.replace(PUNCT_RE, ' ').split(/\s+/).filter(Boolean);
  }

  function normalize(s) {
    return s.trim().replace(PUNCT_RE, '').replace(/\s+/g, ' ');
  }

  // Build a normalized lookup index once (fast exact/near match)
  let _index = null;
  function getIndex() {
    if (_index) return _index;
    _index = new Map();
    const corpus = window.MUNDARI_CORPUS || [];
    for (const [hi, mun] of corpus) {
      const key = normalize(hi);
      if (!_index.has(key)) _index.set(key, mun);
    }
    return _index;
  }

  // Lightweight Dice-coefficient similarity over character bigrams --
  // fast enough to run against ~18k short sentences in a browser.
  function bigrams(s) {
    const b = new Set();
    for (let i = 0; i < s.length - 1; i++) b.add(s.slice(i, i + 2));
    return b;
  }

  function diceSimilarity(a, b) {
    if (a === b) return 1;
    const ba = bigrams(a), bb = bigrams(b);
    if (ba.size === 0 || bb.size === 0) return 0;
    let overlap = 0;
    for (const g of ba) if (bb.has(g)) overlap++;
    return (2 * overlap) / (ba.size + bb.size);
  }

  const SENTENCE_MATCH_THRESHOLD = 0.88;

  function bestCorpusMatch(hiSentence) {
    const norm = normalize(hiSentence);
    const index = getIndex();

    // Fast path: exact normalized match
    if (index.has(norm)) {
      return { mundari: index.get(norm), score: 1 };
    }

    // Fuzzy path: scan corpus for closest sentence (bigram Dice similarity)
    let best = null, bestScore = 0;
    const corpus = window.MUNDARI_CORPUS || [];
    for (let i = 0; i < corpus.length; i++) {
      const [hi, mun] = corpus[i];
      // quick length pre-filter to skip obviously different sentences
      if (Math.abs(hi.length - norm.length) > norm.length * 0.6 + 4) continue;
      const score = diceSimilarity(norm, normalize(hi));
      if (score > bestScore) {
        bestScore = score;
        best = mun;
        if (score > 0.98) break;
      }
    }
    if (best !== null && bestScore >= SENTENCE_MATCH_THRESHOLD) {
      return { mundari: best, score: bestScore };
    }
    return null;
  }

  function wordSubstitution(hiSentence) {
    const lexicon = window.MUNDARI_LEXICON || {};
    const words = tokenize(hiSentence);
    const outWords = [];
    const unknown = [];
    for (const w of words) {
      if (lexicon[w]) {
        outWords.push(lexicon[w]);
      } else {
        outWords.push(w);
        unknown.push(w);
      }
    }
    return { translated: outWords.join(' '), unknown };
  }

  /**
   * Translate a single Hindi sentence.
   * lang: 'mundari' (native, real corpus) or 'ho' (bootstrapped -- Ho and
   * Mundari are closely related North Munda "sister languages" with
   * substantial shared vocabulary, so the same corpus/lexicon is reused
   * as an honest approximation until real Ho-specific data exists. This
   * is NOT verified Ho data -- confidence is capped lower and every
   * result is labeled as bootstrapped.)
   * Returns { nativeScript, method, confidence, unknownWords, verificationTag }
   */
  function translate(hiSentence, lang = 'mundari') {
    if (!hiSentence || !hiSentence.trim()) return null;
    const isBootstrapped = lang === 'ho';

    const corpusHit = bestCorpusMatch(hiSentence);
    if (corpusHit) {
      let confidence = Math.round(80 + corpusHit.score * 19);
      if (isBootstrapped) confidence = Math.round(confidence * 0.65); // real Mundari sentence, but unverified for Ho specifically
      const baseTag = corpusHit.score >= 0.999
        ? 'Exact match - real Hindi-Mundari corpus (Microsoft Research / IIT Kharagpur / Karya)'
        : `Near match (${Math.round(corpusHit.score * 100)}% similar) - real corpus sentence`;
      return {
        nativeScript: corpusHit.mundari,
        method: 'corpus_match',
        confidence,
        unknownWords: [],
        isBootstrapped,
        verificationTag: isBootstrapped
          ? `Bootstrapped from Mundari corpus (Ho is closely related; not verified Ho-specific data) - ${baseTag}`
          : baseTag
      };
    }

    const sub = wordSubstitution(hiSentence);
    const words = tokenize(hiSentence);
    const coverage = words.length ? (words.length - sub.unknown.length) / words.length : 0;
    let confidence = Math.round(35 + coverage * 45);
    if (isBootstrapped) confidence = Math.round(confidence * 0.65);
    const baseTag = sub.unknown.length
      ? `Approximate - word-level statistical substitution (${sub.unknown.length} word${sub.unknown.length > 1 ? 's' : ''} untranslated)`
      : 'Approximate - word-level statistical substitution (IBM Model 1, trained on real corpus)';
    return {
      nativeScript: sub.translated,
      method: 'word_substitution',
      confidence,
      unknownWords: sub.unknown,
      isBootstrapped,
      verificationTag: isBootstrapped
        ? `Bootstrapped from Mundari lexicon (Ho is closely related; not verified Ho-specific data) - ${baseTag}`
        : baseTag
    };
  }

  function splitSentences(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const sentences = [];
    for (const ln of lines) {
      const parts = ln.split(/(?<=[।.!?])\s+/);
      for (const p of parts) if (p.trim()) sentences.push(p.trim());
    }
    return sentences;
  }

  function translateDocument(text, lang = 'mundari') {
    const sentences = splitSentences(text);
    return sentences.map(s => ({ source: s, ...translate(s, lang) }));
  }

  return {
    translate,
    translateDocument,
    splitSentences,
    isReady: () => !!(window.MUNDARI_CORPUS && window.MUNDARI_LEXICON)
  };
})();

window.MUNDARI_ENGINE = MUNDARI_ENGINE;


// === EXTENDED CORPUS INTEGRATION ===
// Search the 17,809-pair Karya extended corpus for better translations
(function() {
  const originalTranslate = window.translateToMundari;
  if (!originalTranslate) return;
  
  window.translateToMundari = function(hindiText) {
    // First try the original engine
    const result = originalTranslate(hindiText);
    
    // If confidence is low, also search the extended corpus
    if (result && result.confidence < 70 && window.MUNDARI_CORPUS_EXTENDED) {
      const cleanInput = hindiText.trim().toLowerCase();
      for (let i = 0; i < window.MUNDARI_CORPUS_EXTENDED.length; i++) {
        const pair = window.MUNDARI_CORPUS_EXTENDED[i];
        if (pair.hi.toLowerCase() === cleanInput || pair.hi.toLowerCase().includes(cleanInput)) {
          result.mundariText = pair.unr;
          result.confidence = 92;
          result.source = 'Karya Extended Corpus';
          break;
        }
      }
    }
    return result;
  };
})();

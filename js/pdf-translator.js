/**
 * Bhasha Setu - PDF Translator (Hindi -> Mundari)
 * Client-side, fully offline once loaded:
 *   1. pdf.js extracts text from the uploaded Hindi PDF
 *   2. MUNDARI_ENGINE (real corpus + lexicon) translates each sentence
 *   3. jsPDF + an embedded Noto Sans Devanagari font renders a new,
 *      downloadable PDF with the Hindi original and Mundari translation
 *      side by side, exactly mirroring the verified Python prototype.
 */
const PDF_TRANSLATOR = (function () {

  let fontRegistered = false;

  function ensureFontRegistered(doc) {
    if (fontRegistered) return;
    if (!window.NOTO_DEVANAGARI_BASE64) {
      throw new Error('Devanagari font not loaded (js/font-devanagari-base64.js missing).');
    }
    doc.addFileToVFS('NotoSansDevanagari.ttf', window.NOTO_DEVANAGARI_BASE64);
    doc.addFont('NotoSansDevanagari.ttf', 'NotoDevanagari', 'normal');
    fontRegistered = true;
  }

  async function extractTextFromPdf(file, onProgress) {
    const arrayBuffer = await file.arrayBuffer();
    const pdfjsLib = window.pdfjsLib || window['pdfjs-dist/build/pdf'];
    if (!pdfjsLib) {
      throw new Error('pdf.js failed to load (check internet connection for the CDN library).');
    }
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/vendor/pdf.worker.min.js';

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(it => it.str).join(' ');
      fullText += pageText + '\n';
      if (onProgress) onProgress(i, pdf.numPages);
    }
    return fullText;
  }

  function translateExtractedText(text) {
    return window.MUNDARI_ENGINE.translateDocument(text);
  }

  function buildOutputPdf(results, sourceFileName) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      throw new Error('jsPDF failed to load (check internet connection for the CDN library).');
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    ensureFontRegistered(doc);

    const pageWidth = 210, marginX = 18, maxWidth = pageWidth - marginX * 2;
    let y = 20;

    // IMPORTANT: the embedded Noto Sans Devanagari font does not include
    // full Latin glyph coverage, so pure-English text rendered with it
    // comes out blank. Use jsPDF's built-in Helvetica for English, and
    // only switch to NotoDevanagari for the actual Hindi/Mundari lines.
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 47);
    doc.setFontSize(16);
    doc.text('Bhasha Setu -- Hindi to Mundari (Real-Data Prototype)', marginX, y);
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(90, 90, 90);
    const introLines = doc.splitTextToSize(
      'Translations backed by the real 17,809-sentence Hindi-Mundari corpus ' +
      '(Microsoft Research India / IIT Kharagpur / Karya) and a statistically ' +
      'trained lexicon (IBM Model 1, 20,560 words). Green text = high-confidence ' +
      'corpus match. Amber text = approximate word-level substitution; any word ' +
      'with no dictionary entry is flagged.',
      maxWidth
    );
    doc.text(introLines, marginX, y);
    y += introLines.length * 4 + 4;

    doc.setDrawColor(225, 225, 225);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 8;

    results.forEach((r, idx) => {
      doc.setFont('NotoDevanagari', 'normal');
      const hiLines = doc.splitTextToSize(`${idx + 1}. ${r.source}`, maxWidth);
      const munLines = doc.splitTextToSize(r.nativeScript, maxWidth);
      const neededHeight = (hiLines.length + munLines.length) * 6 + 14;

      if (y + neededHeight > 285) {
        doc.addPage();
        y = 20;
      }

      doc.setFont('NotoDevanagari', 'normal');
      doc.setFontSize(11.5);
      doc.setTextColor(30, 30, 30);
      doc.text(hiLines, marginX, y);
      y += hiLines.length * 6;

      const isHighConfidence = r.method === 'corpus_match';
      doc.setTextColor(isHighConfidence ? 11 : 178, isHighConfidence ? 93 : 122, isHighConfidence ? 30 : 5);
      doc.text(munLines, marginX, y);
      y += munLines.length * 6;

      // Back to Helvetica for the English confidence/method label
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(150, 150, 150);
      doc.text(
        isHighConfidence ? `corpus match (${r.confidence}% confidence)` : `word-substitution (${r.confidence}% confidence, approximate)`,
        marginX, y
      );
      y += 4;

      if (r.unknownWords && r.unknownWords.length) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(180, 90, 0);
        const warnLines = doc.splitTextToSize('[!] no dictionary entry for: ' + r.unknownWords.join(', '), maxWidth);
        doc.text(warnLines, marginX, y);
        y += warnLines.length * 4;
      }

      y += 4;
    });

    const outName = (sourceFileName || 'document').replace(/\.pdf$/i, '') + '_mundari.pdf';
    doc.save(outName);
  }

  return { extractTextFromPdf, translateExtractedText, buildOutputPdf };
})();

window.PDF_TRANSLATOR = PDF_TRANSLATOR;

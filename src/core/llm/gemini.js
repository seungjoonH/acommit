import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";
import logger from '../../utils/logger.js';

const DEFAULT_MODEL = 'gemini-2.5-flash';

export default function createGemini({ model: moduleModel } = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  const envModel = process.env.GEMINI_MODEL;

  if (!apiKey) {
    logger.error('GEMINI_API_KEY not set. Please add it to your .env or environment.');
    return { gen: async () => ({ text: '', raw: null }) };
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  function pickModel(optsModel) {
    return optsModel || moduleModel || envModel || DEFAULT_MODEL;
  }

  async function gen(prompt, opts = {}) {
    const modelKey = pickModel(opts.model);
    // Try multiple invocation shapes to be resilient across SDK versions
    const payloadText = String(prompt || '');
    const tried = [];
    // Helper to standardize returned text
    const extractText = (res) => {
      if (!res) return '';
      // raw string
      if (typeof res === 'string') return res;

      // If the SDK returned { response: enhancedResponse }
      const inner = res.response || res;

      // If the SDK supplied a helper .text() use it (this is the
      // recommended way for the @google/generative-ai SDK)
      try {
        if (inner && typeof inner.text === 'function') {
          const t = inner.text();
          if (t && typeof t === 'string') return t;
        }
      } catch (e) {
        // if .text() throws (e.g. blocked content), fallthrough and try other ways
      }

      // If SDK put the candidates on the inner object, extract parts
      if (inner && Array.isArray(inner.candidates) && inner.candidates.length > 0) {
        const cand = inner.candidates[0];
        if (cand?.content?.parts && Array.isArray(cand.content.parts)) {
          const parts = cand.content.parts.map(p => p.text || '').filter(Boolean);
          if (parts.length > 0) return parts.join('');
        }
      }

      // Older/other shapes
      if (res.candidates && Array.isArray(res.candidates)) return res.candidates.map(c => c.output || c.content || '').join('\n');

      if (res.output?.[0]?.content) {
        try {
          const parts = res.output.flatMap(o => (o.content || []).map(c => c.text || ''));
          return parts.join('\n');
        } catch (e) {}
      }

      try { return JSON.stringify(res); } catch (e) { return String(res); }
    };

      // Try the GenerativeModel.generateContent API with shapes the SDK expects.
      try {
        const model = genAI.getGenerativeModel ? genAI.getGenerativeModel({ model: modelKey }) : null;
        if (model && typeof model.generateContent === 'function') {
          // 1) Pass the prompt as a plain string (the SDK will format it)
          try {
            tried.push('generateContent:string');
            const r1 = await model.generateContent(payloadText);
            const text1 = extractText(r1?.response || r1);
            if (text1) return { text: text1, raw: r1 };
          } catch (e) { /* ignore and try next shape */ }

          // 2) Explicit contents array
          try {
            tried.push('generateContent:contentsArray');
            const r2 = await model.generateContent({ contents: [payloadText] });
            const text2 = extractText(r2?.response || r2);
            if (text2) return { text: text2, raw: r2 };
          } catch (e) { /* ignore */ }

          // 3) Use formatted chat history (array of content) - as fallback
          try {
            tried.push('generateContent:contentsFormatted');
            const r3 = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: payloadText }] }] });
            const text3 = extractText(r3?.response || r3);
            if (text3) return { text: text3, raw: r3 };
          } catch (e) { /* ignore */ }
        }
      } catch (e) {
        // continue to final error
      }

    // 3) Try top-level convenience methods if present
    try {
      if (typeof genAI.generateText === 'function') {
        tried.push('generateText');
        const r = await genAI.generateText({ model: modelKey, prompt: payloadText });
        const t = extractText(r);
        if (t) return { text: t, raw: r };
      }
    } catch (e) { }

    // If we reach here, none of the invocation styles returned text; return an error
    const errMsg = `No valid response from Gemini SDK (tried: ${tried.join(', ')})`;
    const suggestion = "Ensure @google/generative-ai is installed and up-to-date, and that GEMINI_MODEL is set. Try: npm install @google/generative-ai && export GEMINI_MODEL=gemini-2.5-flash";
    logger.error(`Gemini request failed: ${errMsg} — ${suggestion}`, { exit: false });
    return { text: '', raw: { error: errMsg, suggestion } };
  }

  return { gen };
}
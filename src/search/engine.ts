// src/search/engine.ts
import { pipeline, env } from "@xenova/transformers";
import FlexSearch from "flexsearch";
import type { Verse, Suggestion } from "@/types";

/* ================================
   Transformers.js (CDN + cache)
   ================================ */
env.allowLocalModels = false;     // use remote models (CDN)
env.useBrowserCache = false;       // cache in IndexedDB for fast reloads
env.backends.onnx.wasm.proxy = false;
// env.backends.onnx.wasm.numThreads = 1; // safe default for wide compatibility

const MODEL = "Xenova/all-MiniLM-L6-v2";

/* ================================
   Engine state
   ================================ */
let embedder: any = null;
let embedderInit: Promise<void> | null = null;

let index: any = null;
let verses: Verse[] = [];
let verseEmbeddings: Float32Array[] = []; // filled lazily unless provided

/* ================================
   Helpers
   ================================ */
const cos = (a: Float32Array, b: Float32Array) => {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
};

function rrf(lists: string[][], k = 60) {
  const score: Record<string, number> = {};
  for (const list of lists) {
    list.forEach((id, rank) => { score[id] = (score[id] ?? 0) + 1 / (k + rank + 1); });
  }
  return Object.entries(score).sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

const THEME_MAP: Record<string, string[]> = {
  anxiety: ["anxious", "worry", "fear", "troubled", "peace"],
  forgiveness: ["forgive", "mercy", "grace"],
  love: ["love", "beloved", "compassion", "charity"],
  faith: ["faith", "believe", "trust"],
};

function detectThemes(text: string): string[] {
  const t = text.toLowerCase();
  return Object.entries(THEME_MAP)
    .filter(([, keys]) => keys.some(k => t.includes(k)))
    .map(([theme]) => theme);
}

function buildBM25(data: Verse[]) {
  const idx = new FlexSearch.Document({
    document: { id: "id", index: ["text", "ref", "book"] },
    tokenize: "forward",
  });
  data.forEach(v => idx.add(v));
  return idx;
}

/* ================================
   Embedder init + embedding
   ================================ */
async function ensureEmbedder() {
  if (embedder) return;
  if (embedderInit) return embedderInit;

  embedderInit = (async () => {
    try {
      embedder = await pipeline("feature-extraction", MODEL);
    } catch (e: any) {
      // Most common cause: network/CDN blocked -> model JSON request returns HTML
      const msg = String(e?.message || e);
      const hint =
        msg.includes("Unexpected token <") || /json/i.test(msg)
          ? "Model could not be fetched. Check network access to Hugging Face CDN (huggingface.co)."
          : "Failed to load embedding model.";
      throw new Error(`${hint}\nOriginal error: ${msg}`);
    } finally {
      if (!embedder) embedderInit = null; // allow retry later
    }
  })();

  return embedderInit;
}

async function embed(texts: string[]): Promise<Float32Array[]> {
  await ensureEmbedder();
  const out: Float32Array[] = [];
  for (const t of texts) {
    const r = await embedder(t, { pooling: "mean", normalize: true });
    out.push(r.data as Float32Array);
  }
  return out;
}

/* ================================
   Public API
   ================================ */
export async function initEngine(bible: Verse[], precomputed?: Float32Array[]) {
  verses = bible;
  index = buildBM25(verses);
  verseEmbeddings = precomputed ?? [];
}

/**
 * Returns topK suggestions. Confidence is 0..1 (UI can show %).
 */
// export async function querySuggestions(params: {
//   transcriptWindow: string;      // last ~60–90s of text
//   topK?: number;                 // default 5
//   translation: string;           // "KJV" | "WEB" | etc.
//   hysteresisPrev?: Suggestion | null;
// }): Promise<Suggestion[]> {
//   const { transcriptWindow, translation, topK = 5, hysteresisPrev } = params;
//   const themes = detectThemes(transcriptWindow);

//   // 1) Dense (semantic) search
//   const [qVec] = await embed([transcriptWindow]);

//   // Lazy-embed verse corpus on first need (batched for responsiveness)
//   if (!verseEmbeddings.length) {
//     const batch = 500;
//     for (let i = 0; i < verses.length; i += batch) {
//       const slice = verses.slice(i, i + batch).map(v => v.text);
//       const vecs = await embed(slice);
//       verseEmbeddings.push(...vecs);
//     }
//   }

//   const denseTop = verses
//     .map((v, i) => ({ id: v.id, s: cos(qVec, verseEmbeddings[i]) }))
//     .sort((a, b) => b.s - a.s)
//     .slice(0, 50)
//     .map(x => x.id);

//   // 2) Lexical (BM25)
//   const bm = await index.search(transcriptWindow, { enrich: true, limit: 50 });
//   const bmIds: any[] = [...new Set(bm.flatMap((r: any) => r.result.map((x: any) => x.id)))];

//   // 3) Fusion
//   const fused = rrf([denseTop, bmIds]).slice(0, 40);

//   // 4) Re-rank with small boosts
//   const ranked = fused
//     .map(id => {
//       const v = verses.find(x => x.id === id)!;
//       const themeBoost = v.themes?.some(t => themes.includes(t)) ? 0.05 : 0;
//       const denseScore = cos(qVec, verseEmbeddings[verses.findIndex(x => x.id === id)]);
//       const lexScore = bmIds.includes(id) ? 0.02 : 0;
//       const score = 0.8 * denseScore + 0.15 * lexScore + 0.05 * themeBoost;

//       const reasons: string[] = [];
//       if (themeBoost) reasons.push(`theme match: ${v.themes?.filter(t => themes.includes(t)).join(", ")}`);
//       if (lexScore) reasons.push("lexical phrase match");
//       if (denseScore > 0.6) reasons.push("semantic similarity");

//       return { v, score, reasons };
//     })
//     .sort((a, b) => b.score - a.score);

//   // 5) Hysteresis (keep previous top if new is only slightly better)
//   if (hysteresisPrev && ranked.length) {
//     const top = ranked[0];
//     if (hysteresisPrev.id !== top.v.id && top.score - (hysteresisPrev.confidence ?? 0) < 0.05) {
//       const i = ranked.findIndex(r => r.v.id === hysteresisPrev.id);
//       if (i >= 0) ranked.unshift(ranked.splice(i, 1)[0]);
//     }
//   }

//   // 6) Output normalized suggestions
//   return ranked.slice(0, topK).map(r => ({
//     id: r.v.id,
//     ref: r.v.ref,
//     text: r.v.text,
//     translation,
//     confidence: Number(r.score.toFixed(3)),   // 0..1 for UI to show %
//     themes: r.v.themes,
//     reasons: r.reasons.length ? r.reasons : ["hybrid retrieval"],
//   }));
// }

/**
 * Returns topK suggestions. Confidence is 0..1 (UI can show %).
 */
export async function querySuggestions(params: {
  transcriptWindow: string;      // last ~60–90s of text
  topK?: number;                 // default 5
  translation: string;           // "KJV" | "WEB" | etc.
  hysteresisPrev?: Suggestion | null;
}): Promise<Suggestion[]> {
  const { transcriptWindow, translation, topK = 5, hysteresisPrev } = params;
  
  if (!transcriptWindow.trim()) {
    return []; // Return empty for empty input
  }
  
  const themes = detectThemes(transcriptWindow);

  // 1) Dense (semantic) search
  const [qVec] = await embed([transcriptWindow]);

  // Lazy-embed verse corpus on first need (batched for responsiveness)
  if (!verseEmbeddings.length) {
    const batch = 500;
    for (let i = 0; i < verses.length; i += batch) {
      const slice = verses.slice(i, i + batch).map(v => v.text);
      const vecs = await embed(slice);
      verseEmbeddings.push(...vecs);
    }
  }

  const denseTop = verses
    .map((v, i) => ({ id: v.id, s: cos(qVec, verseEmbeddings[i]) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 50)
    .map(x => x.id);

  // 2) Lexical (BM25)
  const bm = await index.search(transcriptWindow, { enrich: true, limit: 50 }) as any[];
  const bmIds = [...new Set(bm.flatMap(r => r.result?.map((x: any) => String(x.id)) ?? []))];

  // 3) Fusion
  const fused = rrf([denseTop, bmIds]).slice(0, 40);

  // 4) Re-rank with small boosts (WITH NULL GUARDS)
  const ranked = fused
    .map(id => {
      const v = verses.find(x => x.id === id);
      if (!v) {
        console.warn(`Verse not found for id: ${id}`);
        return null;
      }
      
      const vIdx = verses.findIndex(x => x.id === id);
      if (vIdx === -1 || !verseEmbeddings[vIdx]) {
        console.warn(`Embedding not found for id: ${id}`);
        return null;
      }
      
      const themeBoost = v.themes?.some(t => themes.includes(t)) ? 0.05 : 0;
      const denseScore = cos(qVec, verseEmbeddings[vIdx]);
      const lexScore = bmIds.includes(id) ? 0.02 : 0;
      const score = 0.8 * denseScore + 0.15 * lexScore + 0.05 * themeBoost;

      const reasons: string[] = [];
      if (themeBoost && v.themes) {
        reasons.push(`theme match: ${v.themes.filter(t => themes.includes(t)).join(", ")}`);
      }
      if (lexScore) reasons.push("lexical phrase match");
      if (denseScore > 0.6) reasons.push("semantic similarity");

      return { v, score, reasons };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.score - a.score);

  // Guard against empty results
  if (!ranked.length) {
    console.warn("No ranked results found");
    return [];
  }

  // 5) Hysteresis (keep previous top if new is only slightly better)
  if (hysteresisPrev && ranked.length) {
    const top = ranked[0];
    if (hysteresisPrev.id !== top.v.id && top.score - (hysteresisPrev.confidence ?? 0) < 0.05) {
      const i = ranked.findIndex(r => r.v.id === hysteresisPrev.id);
      if (i >= 0) ranked.unshift(ranked.splice(i, 1)[0]);
    }
  }

  // 6) Output normalized suggestions
  return ranked.slice(0, topK).map(r => ({
    id: r.v.id,
    ref: r.v.ref,
    text: r.v.text,
    translation,
    confidence: Number(r.score.toFixed(3)),   // 0..1 for UI to show %
    themes: r.v.themes,
    reasons: r.reasons.length ? r.reasons : ["hybrid retrieval"],
  }));
}
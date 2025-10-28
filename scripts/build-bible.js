// scripts/build-bible.js  (ESM)
import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { USFMParser } = (() => {
  try { return require("usfm-js"); } catch { return {}; }
})();

function autoThemes(s) {
  const t = s.toLowerCase();
  const out = [];
  if (/(anxious|worry|fear|peace)/.test(t)) out.push("anxiety");
  if (/(forgive|mercy|grace)/.test(t)) out.push("forgiveness");
  if (/(love|beloved|compassion)/.test(t)) out.push("love");
  if (/(faith|believe|trust)/.test(t)) out.push("faith");
  return out;
}

function normalizeBook(b) {
  return b.replace(/\s+/g, " ").trim().replace(/\b(\w)/, c => c.toUpperCase());
}
function bookToOSIS(b) { return normalizeBook(b).toUpperCase().replace(/\s+/g, ""); }

// -------- OPTION A: plain text --------
function parsePlainText(txt) {
  const lines = txt.split(/\r?\n/).filter(Boolean);
  const out = [];
  const re = /^([1-3]?\s?[A-Za-z ]+)\s+(\d+):(\d+)\s+(.*)$/; // "John 3:16 For God so loved..."
  for (const line of lines) {
    const m = line.match(re);
    if (!m) continue;
    const [, book, ch, vs, text] = m;
    const id = `${bookToOSIS(book)}.${ch}.${vs}`;
    out.push({
      id,
      ref: `${normalizeBook(book)} ${ch}:${vs}`,
      book: normalizeBook(book),
      chapter: Number(ch),
      verse: Number(vs),
      text: text.trim(),
      themes: autoThemes(text),
    });
  }
  return out;
}

// -------- OPTION B: USFM folder --------
function parseUSFM(dir) {
  if (!USFMParser) throw new Error("Install usfm-js for USFM parsing: npm i usfm-js");
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".usfm"));
  const out = [];
  for (const f of files) {
    const u = fs.readFileSync(path.join(dir, f), "utf8");
    const parsed = USFMParser(u);
    const book = parsed.headers?.bookCode || parsed.headers?.book || "BOOK";
    for (const c of parsed.chapters || []) {
      for (const v of c.verses || []) {
        const text = v.text?.replace(/\s+/g, " ").trim();
        if (!text) continue;
        const id = `${book}.${c.number}.${v.number}`;
        out.push({
          id,
          ref: `${book} ${c.number}:${v.number}`,
          book,
          chapter: c.number,
          verse: v.number,
          text,
          themes: autoThemes(text),
        });
      }
    }
  }
  return out;
}

function main() {
  const mode = process.argv[2]; // "plain" | "usfm"
  const src = process.argv[3];  // file path or directory
  const translation = (process.argv[4] || "KJV").toUpperCase();

  let verses = [];
  if (mode === "plain") {
    const txt = fs.readFileSync(src, "utf8");
    verses = parsePlainText(txt);
  } else if (mode === "usfm") {
    verses = parseUSFM(src);
  } else {
    console.error('Usage: node scripts/build-bible.js <plain|usfm> <file|dir> [TRANSLATION]');
    process.exit(1);
  }

  const outPath = path.join(process.cwd(), "public", `${translation.toLowerCase()}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(verses), "utf8");
  console.log(`Wrote ${verses.length} verses -> ${outPath}`);
}
main();

function cleanBookName(rawName) {
  // normalize spacing/case
  let s = rawName.replace(/\s+/g, " ").trim();

  // drop leading 'The ' (many KJV headings include this)
  s = s.replace(/^The\s+/i, "");

  // collapse common prefixes like 'Book of', 'Book of the Prophet', etc.
  s = s
    .replace(/^Book of\s+/i, "")
    .replace(/^Book of the\s+/i, "")
    .replace(/^Book of the Prophet\s+/i, "")   // e.g., "Book of the Prophet Isaiah" -> "Isaiah"
    .replace(/^Prophet\s+/i, "")
    .replace(/^General\s+/i, "")               // sometimes captured in epistle titles
    .replace(/^Epistle\s+of\s+/i, "")
    .replace(/^Epistle\s+to\s+/i, "")
    .replace(/^Epistle\s+/i, "");

  // Special KJV variants -> canonical names
  const variants = {
    "Song of Songs": "Song of Solomon",
    "Song Of Solomon": "Song of Solomon",
    "Song of Solomon": "Song of Solomon",
    "Psalms": "Psalms",
    "Psalm": "Psalms",

    // 'The Proverbs' -> 'Proverbs'
    "Proverbs": "Proverbs",

    // Lamentations often appears as "Lamentations of Jeremiah"
    "Lamentations of Jeremiah": "Lamentations",

    // Abbreviations
    "1 Sam": "1 Samuel",
    "2 Sam": "2 Samuel",
    "1 Kin": "1 Kings",
    "2 Kin": "2 Kings",
    "1 Chr": "1 Chronicles",
    "2 Chr": "2 Chronicles",
    "1 Cor": "1 Corinthians",
    "2 Cor": "2 Corinthians",
    "1 Thess": "1 Thessalonians",
    "2 Thess": "2 Thessalonians",
    "1 Tim": "1 Timothy",
    "2 Tim": "2 Timothy",
    "1 Pet": "1 Peter",
    "2 Pet": "2 Peter",
  };

  // If we have a direct variant map, use it
  if (variants[s]) return variants[s];

  // Normalize “First/Second/Third Book of …” and “First/Second/Third …” to 1/2/3
  s = s.replace(/^(First|Second|Third)\s+/i, (m, ord) => ({ First: "1 ", Second: "2 ", Third: "3 " }[ord]));

  // Some headings are like "1 Book of Samuel" after previous replacements — collapse that
  s = s.replace(/^(\d)\s+Book of\s+/i, "$1 ");

  // Final tidy (e.g., uppercase/lowercase already handled by matching structure)
  return s.trim();
}

function detectBookFromHeader(line) {
  const l = line.trim().replace(/\s+/g, " ");

  // Moses books form (Genesis–Deuteronomy)
  let m = l.match(/^The\s+(First|Second|Third|Fourth|Fifth)\s+Book\s+of\s+Moses[,:]\s*Called\s+([A-Za-z ]+)$/i);
  if (m) {
    const map = { First: "Genesis", Second: "Exodus", Third: "Leviticus", Fourth: "Numbers", Fifth: "Deuteronomy" };
    return map[m[1]];
  }

  // "The Book of the Prophet Isaiah/Jeremiah/Ezekiel …"
  m = l.match(/^The\s+Book\s+of\s+(?:the\s+Prophet\s+)?([A-Za-z ]+)$/i);
  if (m) {
    const name = cleanBookName(m[1]); // strips "Prophet " etc.
    return BOOK_NAME_TO_OSIS[name] ? name : null;
  }

  // Plain "The Proverbs" (KJV) -> Proverbs
  if (/^The\s+Proverbs$/i.test(l)) return "Proverbs";

  // "The Song of Solomon"
  if (/^The\s+Song\s+of\s+Solomon$/i.test(l)) return "Song of Solomon";

  // "The Lamentations of Jeremiah"
  if (/^The\s+Lamentations\s+of\s+Jeremiah$/i.test(l)) return "Lamentations";

  // "The First/Second Book of Samuel/Kings/Chronicles …"
  m = l.match(/^The\s+(First|Second)\s+Book\s+of\s+(?:the\s+)?([A-Za-z ]+)$/i);
  if (m) {
    const num = m[1] === "First" ? "1" : "2";
    const bookName = cleanBookName(`${num} ${m[2].replace(/^the\s+/i, "")}`);
    return BOOK_NAME_TO_OSIS[bookName] ? bookName : null;
  }

  // Gospels: "The Gospel according to St./Saint Matthew/Mark/Luke/John"
  m = l.match(/^The\s+Gospel\s+(?:according\s+to|of)\s+(?:St\.?\s+|Saint\s+)?([A-Za-z]+)$/i);
  if (m) {
    const name = cleanBookName(m[1]);
    return BOOK_NAME_TO_OSIS[name] ? name : null;
  }

  // Acts
  if (/^The\s+Acts\s+of\s+the\s+Apostles$/i.test(l)) return "Acts";

  // Epistles: e.g., "The First Epistle General of Peter", "The Second Epistle of John", etc.
  m = l.match(/^The\s+(First|Second|Third)?\s*(?:General\s+)?Epistle\s+(?:of\s+)?(?:Paul\s+)?(?:the\s+Apostle\s+)?(?:to\s+)?(?:the\s+)?([A-Za-z ]+?)(?:\s+to)?$/i);
  if (m) {
    const ordinal = m[1] ? ({ First: "1", Second: "2", Third: "3" }[m[1]]) : "";
    let who = cleanBookName(m[2]); // normalize target/author name
    // Handle 1/2/3 John/Peter explicitly when ordinal present
    if (ordinal && /^(John|Peter)$/i.test(who)) {
      const bookName = `${ordinal} ${/john/i.test(who) ? "John" : "Peter"}`;
      return BOOK_NAME_TO_OSIS[bookName] ? bookName : null;
    }
    // Otherwise, the "who" is the canonical book (e.g., Romans, Galatians, James, Jude, Titus…)
    return BOOK_NAME_TO_OSIS[who] ? who : null;
  }

  // Revelation variants
  if (/^The\s+Revelation(?:\s+of\s+St\.?\s+John\s+the\s+Divine)?$/i.test(l) || /Revelation/i.test(l)) {
    return "Revelation";
  }

  // Fallback: direct canonical match after cleaning leading "The", etc.
  const cleaned = cleanBookName(l);
  return BOOK_NAME_TO_OSIS[cleaned] ? cleaned : null;
}

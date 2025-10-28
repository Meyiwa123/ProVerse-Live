export type Verse = {
  id: string;           // "JHN.3.16"
  ref: string;          // "John 3:16"
  book: string;         // "John"
  chapter: number;
  verse: number;
  text: string;
  themes?: string[];    // optional tags ("love","faith",...)
};

export type Suggestion = {
  id: string; ref: string; text: string; translation: string;
  confidence: number; themes?: string[]; reasons: string[];
};
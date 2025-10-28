import { useEffect, useRef, useState } from "react";
import type { Suggestion, Verse } from "../types";
import { initEngine, querySuggestions } from "./engine";

export function useSuggestions(bible: Verse[], translation="KJV") {
  const [ready, setReady] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const lastTop = useRef<Suggestion|null>(null);

  useEffect(() => {
    (async () => { await initEngine(bible); setReady(true); })();
  }, [bible]);

  async function refresh(transcriptWindow: string) {
    if (!ready || !transcriptWindow.trim()) return;
    const result = await querySuggestions({
      transcriptWindow,
      translation,
      hysteresisPrev: lastTop.current,
    });
    setSuggestions(result);
    if (result[0]) lastTop.current = result[0];
  }

  return { ready, suggestions, refresh };
}

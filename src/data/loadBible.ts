import type { Verse } from "@/types";

export async function loadBible(translation = "KJV"): Promise<Verse[]> {
  const url = `/${translation.toLowerCase()}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Bible file not found: ${url}`);
  return (await res.json()) as Verse[];
}

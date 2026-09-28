export const DEFAULT_AREAS = ["Thoughts", "Notes", "Archive"] as const;
const STORAGE_KEY = "pn.areas";

function unique(values: string[]) {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const value of values) {
    const name = value.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(name);
  }
  return next;
}

function readCustomAreas() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function loadAreas(fromNotes: string[] = []) {
  return unique([...DEFAULT_AREAS, ...readCustomAreas(), ...fromNotes]);
}

export function persistAreas(areas: string[]) {
  const custom = unique(areas).filter(
    (area) => !DEFAULT_AREAS.some((name) => name.toLowerCase() === area.toLowerCase())
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
}

export function isDefaultArea(name: string) {
  return DEFAULT_AREAS.some((area) => area.toLowerCase() === name.toLowerCase());
}

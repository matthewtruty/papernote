import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { DEFAULT_AREAS, isDefaultArea, loadAreas, persistAreas } from "./areas";

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      }
    }
  });
});

afterEach(() => {
  store.clear();
});

describe("file areas", () => {
  test("defaults to Thoughts, Notes, Archive", () => {
    expect(loadAreas()).toEqual(["Thoughts", "Notes", "Archive"]);
    expect(DEFAULT_AREAS).toEqual(["Thoughts", "Notes", "Archive"]);
  });

  test("keeps custom areas and folders already used by notes", () => {
    persistAreas(["Work", "Thoughts", "  "]);
    expect(loadAreas(["Inbox", "notes", "Work"])).toEqual([
      "Thoughts",
      "Notes",
      "Archive",
      "Work",
      "Inbox"
    ]);
  });

  test("does not treat custom names as defaults", () => {
    expect(isDefaultArea("Thoughts")).toBe(true);
    expect(isDefaultArea("archive")).toBe(true);
    expect(isDefaultArea("Work")).toBe(false);
  });
});

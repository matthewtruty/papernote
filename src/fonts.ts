export interface FontOption {
  name: string;
  family: string;
  size: string;
  group: "Mono" | "Sans";
}

export const fonts: FontOption[] = [
  { name: "Fira Mono", family: "'Fira Mono', monospace", size: "16px", group: "Mono" },
  { name: "Space Mono", family: "'Space Mono', monospace", size: "15.5px", group: "Mono" },
  { name: "Inconsolata", family: "'Inconsolata', monospace", size: "17px", group: "Mono" },
  { name: "Red Hat Mono", family: "'Red Hat Mono', monospace", size: "15.5px", group: "Mono" },
  { name: "Spline Sans Mono", family: "'Spline Sans Mono', monospace", size: "16px", group: "Mono" },
  { name: "Overpass Mono", family: "'Overpass Mono', monospace", size: "15.5px", group: "Mono" },
  { name: "Sometype Mono", family: "'Sometype Mono', monospace", size: "16px", group: "Mono" },
  { name: "Figtree", family: "'Figtree', sans-serif", size: "17px", group: "Sans" },
  { name: "Manrope", family: "'Manrope', sans-serif", size: "16.5px", group: "Sans" },
  { name: "Hanken Grotesk", family: "'Hanken Grotesk', sans-serif", size: "17px", group: "Sans" },
  { name: "Instrument Sans", family: "'Instrument Sans', sans-serif", size: "17px", group: "Sans" },
  { name: "Rubik", family: "'Rubik', sans-serif", size: "16.5px", group: "Sans" }
];

export const DEFAULT_LIVE_FONT = "Rubik";
export const DEFAULT_MARKDOWN_FONT = "Overpass Mono";

export function findFont(name: string): FontOption {
  return fonts.find((font) => font.name === name) ?? fonts[fonts.length - 1];
}

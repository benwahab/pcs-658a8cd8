import { expect } from "vitest";

/**
 * Several regression tests check that a source file still contains a given
 * piece of code. Matching raw text makes those tests fail whenever Prettier
 * moves a line break, adds a trailing comma or switches quote style, even
 * though the code does exactly the same thing.
 *
 * These helpers compare code instead of layout: whitespace, trailing commas
 * before a closing bracket, quote style and parentheses around a single arrow
 * parameter are ignored. Everything else (identifiers, operators, strings,
 * argument order) must still match exactly.
 */
const strict = (code: string) => code.replace(/\s+/g, "");

const lenient = (code: string) =>
  strict(code)
    .replace(/'/g, '"')
    .replace(/,(?=[)\]}])/g, "")
    .replace(/\((\w+)\)=>/g, "$1=>");

export function containsCode(source: string, snippet: string): boolean {
  return strict(source).includes(strict(snippet)) || lenient(source).includes(lenient(snippet));
}

export function expectCode(source: string) {
  return {
    toContain(snippet: string) {
      expect(containsCode(source, snippet), `Code attendu introuvable : ${snippet}`).toBe(true);
    },
    not: {
      toContain(snippet: string) {
        expect(containsCode(source, snippet), `Code inattendu présent : ${snippet}`).toBe(false);
      },
    },
  };
}

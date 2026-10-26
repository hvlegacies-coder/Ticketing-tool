import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TAXPRACTICE_KB, knowledgeBlock } from "./taxPracticeKb";

const md = readFileSync("supabase/functions/_shared/knowledge/taxpractice-kb.md", "utf8").replace(/\r\n/g, "\n");

describe("TaxPractice knowledge base", () => {
  it("matches the Markdown source exactly (regenerate with node scripts/build-kb.cjs)", () => {
    expect(TAXPRACTICE_KB).toBe(md);
  });

  it("carries the exact error messages agents rely on", () => {
    for (const s of ["Invalid login credentials", "Link not recognized", "Ctrl+Shift+R", "This doesn't look like a 2025 Form 1040."]) {
      expect(TAXPRACTICE_KB).toContain(s);
    }
  });

  it("wraps the handbook with answering and safety rules", () => {
    const block = knowledgeBlock();
    expect(block).toContain(TAXPRACTICE_KB);
    expect(block).toMatch(/only from the handbook/i);
    expect(block).toMatch(/never ask for (a |their )?password/i);
    expect(block).toMatch(/create_ticket/);
  });
});

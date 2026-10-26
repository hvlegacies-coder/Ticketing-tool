import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRACT_KB, TAXPRACTICE_KB, knowledgeBlock } from "./knowledgeBase";

const read = (f: string) => readFileSync(`supabase/functions/_shared/knowledge/${f}`, "utf8").replace(/\r\n/g, "\n");

describe("TaxPractice knowledge base", () => {
  it("matches the Markdown source exactly (regenerate with node scripts/build-kb.cjs)", () => {
    expect(TAXPRACTICE_KB).toBe(read("taxpractice-kb.md"));
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

describe("Contract Workspace knowledge base", () => {
  it("matches the Markdown source exactly (regenerate with node scripts/build-kb.cjs)", () => {
    expect(CONTRACT_KB).toBe(read("contract-workspace-kb.md"));
  });

  it("has no unfilled placeholders and keeps the key on-screen text", () => {
    expect(CONTRACT_KB).not.toMatch(/\[SUPPORT CONTACT/i);
    for (const s of ["Open Contract Template", "Unlock", "Place fields", "Save layout", "Sign & Submit", "Awaiting your signature"]) {
      expect(CONTRACT_KB).toContain(s);
    }
  });

  it("is in the prompt with its safety rules", () => {
    const block = knowledgeBlock();
    expect(block).toContain(CONTRACT_KB);
    expect(block).toContain("CONTRACT WORKSPACE SUPPORT HANDBOOK");
    expect(block).toMatch(/never ask for card numbers/i);
    expect(block).toMatch(/no legal or tax advice/i);
    expect(block).toMatch(/request_human_agent/);
    expect(block).toMatch(/Higher View staff/);
  });
});

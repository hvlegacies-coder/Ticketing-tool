import { beforeEach, describe, expect, it } from "vitest";
import { getVoterEmail, mapSuggestionError, setVoterEmail, suggestionSchema } from "./suggestions";

const valid = { name: "A", email: "a@x.com", title: "Dark mode", description: "d", category: "App" };

describe("suggestionSchema", () => {
  it("accepts a valid suggestion", () => {
    expect(suggestionSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a title shorter than 3 characters", () => {
    expect(suggestionSchema.safeParse({ ...valid, title: "ab" }).success).toBe(false);
  });

  it("rejects an unknown category", () => {
    expect(suggestionSchema.safeParse({ ...valid, category: "Billing" }).success).toBe(false);
  });

  it("rejects an invalid email", () => {
    expect(suggestionSchema.safeParse({ ...valid, email: "nope" }).success).toBe(false);
  });

  it("rejects a description over 4000 characters", () => {
    expect(suggestionSchema.safeParse({ ...valid, description: "x".repeat(4001) }).success).toBe(false);
  });
});

describe("mapSuggestionError", () => {
  it("explains the daily limit", () => {
    expect(mapSuggestionError({ message: "rate_limited" })).toBe(
      "You've posted 5 suggestions today. Please try again tomorrow.",
    );
  });

  it("falls back to a generic message", () => {
    expect(mapSuggestionError({ message: "boom" })).toBe("Couldn't save your suggestion. Please try again.");
  });
});

describe("voter email", () => {
  beforeEach(() => localStorage.clear());

  it("reads a stored email", () => {
    localStorage.setItem("hv-voter-email", "a@x.com");
    expect(getVoterEmail()).toBe("a@x.com");
  });

  it("round-trips through setVoterEmail", () => {
    setVoterEmail("b@x.com");
    expect(getVoterEmail()).toBe("b@x.com");
  });

  it("returns null when nothing is stored", () => {
    expect(getVoterEmail()).toBeNull();
  });
});

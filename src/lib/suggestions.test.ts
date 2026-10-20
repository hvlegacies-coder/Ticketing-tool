import { beforeEach, describe, expect, it } from "vitest";
import {
  SUGGESTION_STATUSES,
  getVoterEmail,
  glowLevel,
  groupRoadmap,
  mapSuggestionError,
  setVoterEmail,
  statusStep,
  suggestionSchema,
} from "./suggestions";

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

describe("groupRoadmap", () => {
  it("buckets suggestions into the three roadmap columns and drops the rest", () => {
    const rows = [
      { id: "1", status: "Planned" },
      { id: "2", status: "In progress" },
      { id: "3", status: "Done" },
      { id: "4", status: "Under review" },
      { id: "5", status: "Declined" },
      { id: "6", status: "Planned" },
    ];
    const g = groupRoadmap(rows);
    expect(g.Planned.map((r) => r.id)).toEqual(["1", "6"]);
    expect(g["In progress"].map((r) => r.id)).toEqual(["2"]);
    expect(g.Done.map((r) => r.id)).toEqual(["3"]);
  });
});

describe("glowLevel", () => {
  it.each([
    [0, 0],
    [4, 0],
    [5, 1],
    [19, 1],
    [20, 2],
    [49, 2],
    [50, 3],
    [500, 3],
  ])("%i votes -> level %i", (votes, level) => {
    expect(glowLevel(votes)).toBe(level);
  });
});

describe("statusStep", () => {
  it("maps statuses to progress steps 1-5 and Declined to 0", () => {
    expect(SUGGESTION_STATUSES.map(statusStep)).toEqual([1, 2, 3, 4, 0]);
  });
});

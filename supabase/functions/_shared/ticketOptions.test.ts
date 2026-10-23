import { expect, it } from "vitest";
import { ISSUE_CATEGORIES, PRIORITY_OPTIONS } from "../../../src/lib/mondayConfig";
import { TICKET_CATEGORIES, TICKET_PRIORITIES } from "./ticketOptions";

// The AI tool's enums must match the app's lists exactly: SLA policies are
// keyed on the full priority strings.
it("matches the frontend category and priority lists", () => {
  expect([...TICKET_CATEGORIES]).toEqual([...ISSUE_CATEGORIES]);
  expect([...TICKET_PRIORITIES]).toEqual([...PRIORITY_OPTIONS]);
});

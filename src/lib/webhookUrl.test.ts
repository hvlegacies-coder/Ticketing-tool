import { expect, it } from "vitest";
import { isValidWebhookUrl } from "./webhookUrl";

it("accepts only https URLs", () => {
  expect(isValidWebhookUrl("https://services.leadconnectorhq.com/hooks/abc")).toBe(true);
  expect(isValidWebhookUrl("http://x.com")).toBe(false);
  expect(isValidWebhookUrl("")).toBe(false);
});

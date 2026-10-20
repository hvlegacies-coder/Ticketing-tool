import { expect, test } from "@playwright/test";

// Needs a migrated project with org slug E2E_ORG_SLUG and a staff login.
const orgSlug = process.env.E2E_ORG_SLUG ?? "higherview";
const staffEmail = process.env.E2E_STAFF_EMAIL;
const staffPassword = process.env.E2E_STAFF_PASSWORD;

test.skip(!staffEmail || !staffPassword, "set E2E_STAFF_EMAIL and E2E_STAFF_PASSWORD to run");

test("customer hands off from AI to a live agent and staff see it in the bell", async ({ browser }) => {
  const message = `hello from e2e ${Date.now()}`;

  const customer = await (await browser.newContext()).newPage();
  await customer.goto(`/support/${orgSlug}`);
  await customer.getByRole("button", { name: "Open support chat" }).click();
  await customer.getByRole("button", { name: /Talk to an agent/ }).click();
  await customer.getByLabel("Your name").fill("E2E Tester");
  await customer.getByLabel("Email").fill(`e2e+${Date.now()}@example.com`);
  await customer.getByRole("button", { name: "Connect me" }).click();
  await expect(customer.getByText(/LIVE · TICKET #/)).toBeVisible();
  await customer.getByPlaceholder("Type your message...").fill(message);
  await customer.keyboard.press("Enter");
  await expect(customer.getByText(message)).toBeVisible();

  const staff = await (await browser.newContext()).newPage();
  await staff.goto("/login");
  await staff.getByLabel("Email").fill(staffEmail!);
  await staff.getByLabel("Password").fill(staffPassword!);
  await staff.getByRole("button", { name: /Sign In/ }).click();
  await staff.waitForURL(/\/app\//);
  await staff.goto(`/app/${orgSlug}/dashboard`);
  const bell = staff.getByRole("button", { name: /Notifications: \d+ waiting/ });
  await expect(bell).toBeVisible();
  await bell.click();
  await staff.getByText("E2E Tester").first().click();
  await expect(staff.getByText(message)).toBeVisible();
});

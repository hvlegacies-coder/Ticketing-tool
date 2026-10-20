# Futuristic Support Desk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Claude AI chat with human handoff into live customer↔staff chat, staff bell + GoHighLevel webhook, a public suggestions forum, and a Cyber Neon + gold dark redesign.

**Architecture:** Reuse the existing token-gated client chat (`get_ticket_messages_by_token` / `send_client_message_by_token`, 6s polling in `ClientTicketMessages`) and the anonymous ticket insert path (client-generated `id` + `client_access_token`). New server logic lives in Supabase edge functions with pure helpers in `supabase/functions/_shared/` so Vitest can test them. New public data access goes through `SECURITY DEFINER` RPCs, matching `get_org_public_profile`. The redesign is a token rewrite in `src/index.css` + `tailwind.config.ts`.

**Tech Stack:** Vite, React 18, TypeScript, shadcn/ui, Tailwind, framer-motion, TanStack Query, Supabase (Postgres RLS, Edge Functions on Deno, pg_net), `npm:@anthropic-ai/sdk`, Vitest (jsdom), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-20-futuristic-support-desk-design.md`

## Global Constraints

- Every new table/RPC is scoped by `organization_id`; RLS enforced; anon never gets direct table grants on new tables.
- Model: `claude-opus-5-5`, `output_config: { effort: "low" }`, `max_tokens: 2048`, beta `server-side-fallback-2026-07-01` with `fallbacks: "default"`. Do not send `thinking: {type: "disabled"}` or forced `tool_choice` (`any`/`tool`) — both 400 on this model.
- Secrets only via Supabase secrets: `ANTHROPIC_API_KEY`, `PUBLIC_APP_URL`, `RESEND_API_KEY`, `NOTIFY_WEBHOOK_SECRET`. Never in `.env`, client code, or git.
- AI chat limits: max 30 messages per conversation, max 2,000 chars per message.
- Suggestion limit: max 5 per `author_email` per org per 24h.
- Colors: background `#070b1a`, cyan `#00e5ff`, violet `#a855f7`, gold gradient `#d4a017 → #f5d26b`. Heading font Orbitron, body Inter. Dark-only.
- Copy: AI widget greeting "Hi! Describe your issue and I'll help — or connect you to a person." Handoff chip label "Talk to an agent".
- All `localStorage` / `sessionStorage` access wrapped in try/catch.
- Do **not** run `supabase db push` / `functions deploy` against `neazbcjsrgacokttdrtn` (referral app). DB-applying steps run only against a confirmed-empty dedicated project; until then they are verified by `supabase db lint` on a local stack if available, otherwise by review.

## Review Focus

1. Customer reloads the page mid live chat → widget resumes the same ticket thread (sessionStorage), not a fresh AI chat. Test in Task 5.
2. Customer clicks "Talk to an agent" twice / double-submits the handoff form → exactly one ticket created. Test in Task 5.
3. Claude API down or returns 429 → widget shows fallback text with ticket form + agent option; no unhandled error. Test in Task 3 (`parseChatResult` error path) and Task 5.
4. GHL URL is blank, non-https, or slow (>5s) → chat unaffected, nothing thrown. Test in Task 6 (`isValidWebhookUrl`, timeout).
5. Same email votes twice on a suggestion → count stays +1. SQL check in Task 1; UI optimistic state reverts on error in Task 7.

---

### Task 0: Remove Lovable runtime dependencies

**Files:**
- Modify: `supabase/functions/process-email-queue/index.ts` (delete function dir if nothing invokes it)
- Modify: `supabase/functions/send-ticket-email/index.ts:30`, `send-ticket-processing-email/index.ts:30`, `send-ticket-resolved-email/index.ts:30`, `monday-webhook/index.ts:165,189`
- Create: `supabase/functions/_shared/appUrl.ts`
- Create: `supabase/functions/_shared/appUrl.test.ts`
- Modify: `vitest.config.ts` (`include` adds `"supabase/functions/_shared/**/*.test.ts"`)

**Interfaces:**
- Produces: `appUrl(path: string, base?: string): string` — joins `base` (default `Deno.env.get("PUBLIC_APP_URL")` read by caller and passed in) with `path`, no double slashes; throws `Error("PUBLIC_APP_URL not set")` if base empty.

- [ ] **Step 1:** `grep -rn "process-email-queue" src supabase` — if no caller, delete `supabase/functions/process-email-queue/`; otherwise replace `sendLovableEmail` with a `fetch('https://api.resend.com/emails')` call matching `send-ticket-email/index.ts:159`.
- [ ] **Step 2: Write failing test** `appUrl.test.ts`:
  ```ts
  expect(appUrl("/t/abc", "https://x.com/")).toBe("https://x.com/t/abc");
  expect(appUrl("t/abc", "https://x.com")).toBe("https://x.com/t/abc");
  expect(() => appUrl("/t/abc", "")).toThrow("PUBLIC_APP_URL not set");
  ```
- [ ] **Step 3:** Run `npx vitest run supabase/functions/_shared/appUrl.test.ts` → FAIL (module missing).
- [ ] **Step 4:** Implement `appUrl` (pure; no `Deno` reference inside the module).
- [ ] **Step 5:** Replace every `ticket-sync-co.lovable.app` fallback with `appUrl("/t/<token>", Deno.env.get("PUBLIC_APP_URL") ?? "")`. The old `/ticket/${ticketId}/chat` path is dead — use `/t/<client_access_token>` where the token is available, else the provided `chatLink`.
- [ ] **Step 6:** `npx vitest run` → PASS; `grep -rn "lovable.app\|@lovable.dev" supabase/functions` → only `support-chat` remains (Task 2 removes it).
- [ ] **Step 7:** Commit `chore: remove Lovable runtime dependencies from edge functions`.

---

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20261020120000_live_chat_suggestions.sql`
- Create: `supabase/tests/live_chat_suggestions_checks.sql` (manual verification script)
- Modify: `src/integrations/supabase/types.ts` (add new columns/tables/RPCs by hand to match; regenerate after DB exists)

**Interfaces:**
- Produces (SQL):
  - `tickets.agent_requested_at timestamptz null`
  - `organization_integrations.ghl_webhook_url text null check (ghl_webhook_url ~ '^https://')`
  - Trigger `clear_agent_requested_on_support_reply` AFTER INSERT ON `chat_messages` WHEN `sender_type='support'` → sets ticket `agent_requested_at = null`.
  - `upsert_org_integration_settings(_org_id, _monday_api_token, _monday_board_id, _monday_group_id, _ai_chat_enabled, _ai_system_prompt_override, _ghl_webhook_url text default null)` — drop + recreate with the extra arg; grants as before.
  - `get_org_integration_settings` returns `ghl_webhook_url` too (owner/admin only, existing check).
  - Tables `suggestions`, `suggestion_votes` exactly as in spec §3.
  - Trigger `suggestion_vote_count` AFTER INSERT ON `suggestion_votes` → `vote_count = vote_count + 1`.
  - Trigger `suggestion_rate_limit` BEFORE INSERT ON `suggestions` → `raise exception 'rate_limited'` when ≥5 rows same org + lower(`author_email`) in last 24h.
  - RPC `get_public_suggestions(_slug text, _sort text)` returns `(id, title, description, category, status, vote_count, author_name, created_at)`; `_sort` in `('top','new')`, top = `vote_count desc, created_at desc`; excludes `is_hidden`. Grant anon, authenticated.
  - RPC `create_suggestion(_slug text, _name text, _email text, _title text, _description text, _category text) returns uuid`. Grant anon, authenticated.
  - RPC `vote_suggestion(_id uuid, _email text) returns integer` (new `vote_count`; insert `on conflict do nothing`; email lower-cased). Grant anon, authenticated.
  - RLS on `suggestions`: select for any org member (`has_org_role(organization_id, ARRAY['owner','admin','agent','viewer'])`); update for `owner,admin,agent`; delete for `owner,admin`. `suggestion_votes`: select for org members via join; no insert/update/delete policies (RPC only).
  - Trigger `notify_ghl_agent_requested` AFTER UPDATE OF `agent_requested_at` ON `tickets` (old null → new not null) and AFTER INSERT ON `tickets` when `agent_requested_at` not null; trigger `notify_ghl_client_message` AFTER INSERT ON `chat_messages` WHEN `sender_type='client'`. Both call `net.http_post` to `(select decrypted_secret from vault.decrypted_secrets where name='project_url') || '/functions/v1/notify-webhook'` with header `x-notify-secret` = vault secret `notify_webhook_secret` and body `{"event": ..., "ticket_id": ..., "message_id": ...}`. If either vault secret is missing, the trigger function returns without calling (no error).
  - `create extension if not exists pg_net;`
  - `tickets` added to `supabase_realtime` publication if not already a member (guard with a `pg_publication_tables` check); `chat_messages` already is (existing dashboard toast relies on it).

- [ ] **Step 1:** Write the migration with the objects above. Every `SECURITY DEFINER` function: `SET search_path = public`, `REVOKE ALL ... FROM PUBLIC` then explicit grants (pattern: `20260723190300_integrations_public_access_security.sql:84-104`).
- [ ] **Step 2:** Write `supabase/tests/live_chat_suggestions_checks.sql` with `DO $$ ... ASSERT ... $$` blocks covering: vote twice same email (any case) → `vote_count = 1`; 6th suggestion in 24h raises `rate_limited`; `get_public_suggestions` result has no `author_email` column and excludes hidden rows; anon role `select` on `suggestions` → permission denied; support message insert clears `agent_requested_at`; org-B member cannot select org-A `suggestions`.
- [ ] **Step 3:** If a local Supabase stack is available (`npx supabase start`), run `npx supabase db reset` then `psql "$LOCAL_DB_URL" -f supabase/tests/live_chat_suggestions_checks.sql` → all asserts pass. If not available, mark this step "pending: run on dedicated project" in the commit message.
- [ ] **Step 4:** Update `src/integrations/supabase/types.ts` for the new columns, tables and RPC signatures so later tasks type-check. Run `npx tsc -p tsconfig.app.json --noEmit` → no new errors.
- [ ] **Step 5:** Commit `feat(db): live chat handoff, GHL webhook triggers, suggestions forum`.

---

### Task 2: Claude `support-chat` edge function

**Files:**
- Create: `supabase/functions/_shared/chatLogic.ts`
- Create: `supabase/functions/_shared/chatLogic.test.ts`
- Modify: `supabase/functions/support-chat/index.ts` (replace Lovable call; keep `DEFAULT_SYSTEM_PROMPT`, CORS, `organization_integrations` lookup at lines 160-180)

**Interfaces:**
- Produces:
  - `type ChatTurn = { role: "user" | "assistant"; content: string }`
  - `validateChatRequest(body: unknown): { ok: true; organizationId: string | null; messages: ChatTurn[] } | { ok: false; error: string }` — errors: `"too_many_messages"` (>30), `"message_too_long"` (any content >2000), `"invalid_body"`.
  - `parseChatResult(resp: { stop_reason: string; content: Array<{ type: string; text?: string; name?: string }> }): { reply: string; handoff: boolean }`
  - HTTP contract: `POST support-chat` body `{ organizationId, messages: ChatTurn[] }` → 200 `{ reply: string, handoff: boolean }`; 400 `{ error }` for validation; 502 `{ error: "ai_unavailable" }` for upstream failure.
- Tool definition (exact): name `request_human_agent`, `strict: true`, `input_schema: { type: "object", properties: { reason: { type: "string" } }, required: ["reason"], additionalProperties: false }`, `tool_choice: { type: "auto" }`.

- [ ] **Step 1: Write failing tests** in `chatLogic.test.ts`:
  ```ts
  // validateChatRequest
  expect(validateChatRequest({ messages: Array(31).fill({ role: "user", content: "x" }) })).toEqual({ ok: false, error: "too_many_messages" });
  expect(validateChatRequest({ messages: [{ role: "user", content: "x".repeat(2001) }] })).toEqual({ ok: false, error: "message_too_long" });
  expect(validateChatRequest({ messages: "nope" })).toEqual({ ok: false, error: "invalid_body" });
  // parseChatResult
  expect(parseChatResult({ stop_reason: "end_turn", content: [{ type: "text", text: "Hi" }] })).toEqual({ reply: "Hi", handoff: false });
  expect(parseChatResult({ stop_reason: "tool_use", content: [{ type: "text", text: "Connecting you" }, { type: "tool_use", name: "request_human_agent" }] })).toEqual({ reply: "Connecting you", handoff: true });
  expect(parseChatResult({ stop_reason: "tool_use", content: [{ type: "tool_use", name: "request_human_agent" }] }).reply).toBe("Sure — I'll connect you with a team member.");
  expect(parseChatResult({ stop_reason: "refusal", content: [] })).toEqual({ reply: "Sorry, I can't help with that here. Let me connect you with a team member.", handoff: true });
  ```
- [ ] **Step 2:** `npx vitest run supabase/functions/_shared/chatLogic.test.ts` → FAIL.
- [ ] **Step 3:** Implement both functions in `chatLogic.ts` (pure, no Deno/SDK imports). Thinking blocks in `content` are ignored.
- [ ] **Step 4:** `npx vitest run` → PASS.
- [ ] **Step 5:** Rewrite `support-chat/index.ts`: `import Anthropic from "npm:@anthropic-ai/sdk"`; `client.beta.messages.create({ model: "claude-opus-5-5", max_tokens: 2048, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default", output_config: { effort: "low" }, system, tools: [requestHumanAgentTool], tool_choice: { type: "auto" }, messages })`. Append to the system prompt: "If the customer asks for a human, an agent, or a real person, or you cannot resolve their issue, call request_human_agent. Keep replies under 120 words." Map `Anthropic.APIError` / network errors → 502. Keep the `ai_chat_enabled === false` early return but change its shape to `{ reply, handoff: false }`. Remove all `LOVABLE_API_KEY` references.
- [ ] **Step 6:** Type-check with `npx deno check supabase/functions/support-chat/index.ts` if Deno is installed; otherwise skip and note it.
- [ ] **Step 7:** Commit `feat(ai): switch support chat to Claude with human-agent handoff tool`.

---

### Task 3: Widget AI client + live-chat state

**Files:**
- Create: `src/lib/supportChat.ts`
- Create: `src/lib/supportChat.test.ts`

**Interfaces:**
- Consumes: Task 2 HTTP contract.
- Produces:
  - `sendAiMessage(organizationId: string, messages: ChatTurn[]): Promise<{ reply: string; handoff: boolean }>` — calls `supabase.functions.invoke("support-chat")`; on any error resolves `{ reply: AI_FALLBACK_TEXT, handoff: false }` (never throws). `AI_FALLBACK_TEXT = "I'm having trouble connecting right now. You can submit a ticket with the form, or tap \"Talk to an agent\"."`
  - `buildTranscript(messages: ChatTurn[]): string` — `"Customer: …\nAI: …"` lines, truncated to 10,000 chars.
  - `createHandoffTicket(input: { organizationId: string; name: string; email: string; transcript: string }): Promise<{ ticketId: string; token: string }>` — inserts via the same path as `TicketForm.tsx:119-142` (`crypto.randomUUID()`, `generateClientAccessToken()`), with `issue_title: "Live chat request"`, `issue_category: "Live Chat"`, `company_name: "—"`, `priority: "Medium"`, `issue_description: transcript`, `chatbot_transcript: transcript`, `agent_requested_at: new Date().toISOString()`.
  - `saveLiveSession(orgId: string, s: { ticketId: string; token: string; name: string; email: string }): void`, `loadLiveSession(orgId: string): { ticketId; token; name; email } | null`, `clearLiveSession(orgId: string): void` — sessionStorage key `hv-live-chat:<orgId>`, try/catch, invalid JSON → null.

- [ ] **Step 1: Write failing tests** (mock `@/integrations/supabase/client` with `vi.mock`):
  ```ts
  // sendAiMessage returns fallback when invoke errors
  invoke.mockResolvedValue({ data: null, error: new Error("boom") });
  await expect(sendAiMessage("org", [])).resolves.toEqual({ reply: AI_FALLBACK_TEXT, handoff: false });
  // buildTranscript
  expect(buildTranscript([{ role: "user", content: "a" }, { role: "assistant", content: "b" }])).toBe("Customer: a\nAI: b");
  expect(buildTranscript([{ role: "user", content: "x".repeat(20000) }]).length).toBe(10000);
  // session round trip + corrupt value
  saveLiveSession("o1", { ticketId: "t", token: "k", name: "n", email: "e@x.com" });
  expect(loadLiveSession("o1")?.token).toBe("k");
  sessionStorage.setItem("hv-live-chat:o2", "{bad");
  expect(loadLiveSession("o2")).toBeNull();
  // createHandoffTicket insert payload
  await createHandoffTicket({ organizationId: "o", name: "N", email: "e@x.com", transcript: "T" });
  expect(insert).toHaveBeenCalledWith(expect.objectContaining({ issue_title: "Live chat request", issue_category: "Live Chat", agent_requested_at: expect.any(String) }));
  ```
- [ ] **Step 2:** `npx vitest run src/lib/supportChat.test.ts` → FAIL.
- [ ] **Step 3:** Implement `src/lib/supportChat.ts`. Export `ChatTurn` from here (frontend copy; do not import from `supabase/functions`).
- [ ] **Step 4:** `npx vitest run` → PASS.
- [ ] **Step 5:** Commit `feat(chat): AI client, handoff ticket creation, live session storage`.

---

### Task 4: Redesign theme foundation

Done before the UI tasks so new components are built on the final tokens.

**Files:**
- Modify: `src/index.css` (`:root` → neon palette; delete `.dark` block; add utilities)
- Modify: `tailwind.config.ts` (gradients, `fontFamily.display`, `boxShadow.glow-cyan` / `glow-gold`)
- Modify: `index.html` or `src/index.css:1` font import (add Orbitron 500/700)
- Modify: `src/components/ThemeProvider.tsx` (always `dark`, ignore storage; keep `useTheme` export returning `{ theme: "dark", setTheme: () => {} }` so callers compile until Task 9 removes them)

**Interfaces:**
- Produces CSS classes: `.glass` (bg `rgba(10,18,40,.85)`, `backdrop-blur-md`, 1px border cyan @ 33% alpha), `.grid-bg` (22px cyan grid @ 7% alpha on `#070b1a`), `.glow-cyan`, `.glow-gold`, `.text-gold`, `.font-display` (Orbitron). `bg-gradient-gold` = `linear-gradient(90deg,#d4a017,#f5d26b)`; `bg-gradient-hero` = navy radial with cyan/violet tint.
- `@media (prefers-reduced-motion: reduce)` disables `.animate-*` classes defined here and transitions on `.glow-*`.

- [ ] **Step 1:** Rewrite tokens (HSL values for shadcn vars): `--background` ≈ `#070b1a`, `--card`/`--popover` ≈ `#0a1228`, `--primary` gold `#d4a017` with `--primary-foreground` `#141005`, `--accent` violet, `--ring` cyan, `--border` cyan low-alpha equivalent, `--muted-foreground` ≥ 4.5:1 on background.
- [ ] **Step 2:** Verify contrast: `--foreground` and `--muted-foreground` against `--background` and `--card` ≥ 4.5:1 (compute with any contrast checker; record ratios in the commit body).
- [ ] **Step 3:** `npm run build` → succeeds; `npm run dev` and open `/`, `/login`, `/support/higherview` → dark neon renders, no white flashes.
- [ ] **Step 4:** Commit `style: Cyber Neon + gold dark theme tokens`.

---

### Task 5: Futuristic chat widget with live mode

**Files:**
- Modify (rewrite): `src/components/SupportChatWidget.tsx`
- Create: `src/components/chat/AiOrb.tsx`, `src/components/chat/ThinkingWave.tsx`, `src/components/chat/HandoffForm.tsx`
- Create: `src/components/SupportChatWidget.test.tsx`

**Interfaces:**
- Consumes: Task 3 (`sendAiMessage`, `createHandoffTicket`, `buildTranscript`, `save/load/clearLiveSession`), Task 4 classes, existing `ClientTicketMessages({ token, senderName, senderEmail })`.
- Produces: `SupportChatWidget({ organizationId, onTicketDraft })` — props unchanged.
- `HandoffForm({ onSubmit(name: string, email: string): Promise<void>, submitting: boolean })` — validates with `zod` (`name` 1-100, `email` `.email()`), submit button disabled while `submitting`.

- [ ] **Step 1: Write failing tests** (React Testing Library; mock `@/lib/supportChat`):
  - greeting text "Hi! Describe your issue and I'll help — or connect you to a person." visible after opening.
  - clicking "Talk to an agent" shows the handoff form.
  - submitting the form twice quickly calls `createHandoffTicket` exactly once.
  - after successful handoff, `ClientTicketMessages` is rendered with the returned token and `saveLiveSession` was called.
  - with `loadLiveSession` returning a session on mount, the widget opens straight into live mode (no AI greeting).
  - `sendAiMessage` resolving `{ handoff: true }` shows the handoff form.
  - in live mode, before any `support` message the header shows "Waiting for an agent…"; once `get_ticket_messages_by_token` returns a `support` message, a gold system line "⚡ <sender_name> joined the chat" appears once. Add optional prop `onSupportJoined?(name: string)` to `ClientTicketMessages` (called once on first `support` message) to drive this.
- [ ] **Step 2:** `npx vitest run src/components/SupportChatWidget.test.tsx` → FAIL.
- [ ] **Step 3:** Implement. Layout per approved mockup A: floating window bottom-right, `.glass` panel, header with `AiOrb` (radial cyan→violet, 2px gold ring) + "HIGHERVIEW AI" (gold "AI") + "● ONLINE" line; user bubbles `bg-gradient-gold`, AI bubbles cyan-tinted, agent bubbles violet-tinted; `ThinkingWave` (5 bars, CSS keyframes, disabled under reduced motion) while awaiting reply; chips "Talk to an agent" (gold), "Track refund", "Upload docs" (chips send their label as a user message, except the agent chip). Live mode: header subtitle "LIVE · TICKET #<first 4 of id>", body is `ClientTicketMessages`, plus the `/t/<token>` link and an "End chat" button that calls `clearLiveSession`. Keep "Create ticket from conversation" when `messages.length > 3`.
- [ ] **Step 4:** `npx vitest run` → PASS.
- [ ] **Step 5:** Manual: `npm run dev`, `/support/higherview`, open widget, verify layout matches mockup, keyboard focus visible, `Esc` closes.
- [ ] **Step 6:** Commit `feat(widget): futuristic AI chat with live agent handoff`.

---

### Task 6: Staff notification bell + GHL webhook

**Files:**
- Create: `src/components/NotificationBell.tsx`, `src/hooks/useStaffNotifications.ts`, `src/hooks/useStaffNotifications.test.ts`
- Modify: `src/components/AppShell.tsx` (mount bell in top bar; remove theme toggle at lines ~123-127)
- Modify: `src/pages/AdminDashboard.tsx:74-99` (delete the realtime toast effect; moved into the hook)
- Create: `supabase/functions/_shared/webhookPayload.ts`, `supabase/functions/_shared/webhookPayload.test.ts`
- Create: `supabase/functions/notify-webhook/index.ts`
- Modify: `supabase/config.toml` (`[functions.notify-webhook] verify_jwt = false`)
- Modify: `src/pages/Settings.tsx` (GHL URL field next to Monday settings; pass `_ghl_webhook_url` to `upsert_org_integration_settings`)

**Interfaces:**
- Consumes: Task 1 columns, triggers, RPC signature.
- Produces:
  - `useStaffNotifications(orgId: string | undefined): { items: StaffNotification[]; count: number }` where `StaffNotification = { kind: "agent_requested" | "client_message"; ticketId: string; customerName: string; preview: string; at: string }`. Queries: tickets in org with `agent_requested_at not null`; `chat_messages` joined to org tickets with `sender_type='client' and is_read=false`. Realtime: `postgres_changes` on `chat_messages` INSERT and `tickets` UPDATE, client-side filtered to the org's ticket ids; on new item → `toast.info` + play `/notify.mp3` (catch autoplay rejection).
  - `mergeNotifications(waiting: Ticket[], unread: Message[]): StaffNotification[]` (exported, pure) — newest first, a ticket in both lists appears once as `agent_requested`.
  - `buildWebhookPayload(input: { event: "agent_requested" | "client_message"; org: { id; slug; name }; ticket: { id; client_full_name; email; client_access_token }; message: string; createdAt: string; appUrl: string }): GhlPayload` — shape exactly per spec §1 (`chat_url` = `appUrl("/t/<token>")`, `admin_url` = `appUrl("/app/<slug>/ticket/<id>")`).
  - `isValidWebhookUrl(url: string | null): boolean` — true only for parseable `https:` URLs.
  - `notify-webhook` HTTP: rejects with 401 unless header `x-notify-secret` equals `Deno.env.get("NOTIFY_WEBHOOK_SECRET")`; loads ticket/org/message with service role; reads `organization_integrations.ghl_webhook_url`; if `!isValidWebhookUrl` → 204; else `fetch` with `AbortSignal.timeout(5000)`; any failure → `console.error` + 202. Never 5xx to the trigger.

- [ ] **Step 1: Write failing tests:**
  ```ts
  // webhookPayload.test.ts
  const p = buildWebhookPayload({ event: "client_message", org: { id: "o", slug: "higherview", name: "HV" }, ticket: { id: "t1", client_full_name: "Ann", email: "a@x.com", client_access_token: "tok" }, message: "hi", createdAt: "2026-10-20T00:00:00Z", appUrl: "https://app.x" });
  expect(p.chat_url).toBe("https://app.x/t/tok");
  expect(p.admin_url).toBe("https://app.x/app/higherview/ticket/t1");
  expect(p.customer_name).toBe("Ann");
  expect(isValidWebhookUrl("http://x.com")).toBe(false);
  expect(isValidWebhookUrl("")).toBe(false);
  expect(isValidWebhookUrl(null)).toBe(false);
  expect(isValidWebhookUrl("https://services.leadconnectorhq.com/hooks/abc")).toBe(true);
  // useStaffNotifications.test.ts
  expect(mergeNotifications([waitingT1], [unreadOnT1, unreadOnT2]).map(n => [n.kind, n.ticketId])).toEqual([["client_message","t2"],["agent_requested","t1"]]); // fixture times: t2 msg newest
  ```
- [ ] **Step 2:** `npx vitest run` → FAIL.
- [ ] **Step 3:** Implement `_shared/webhookPayload.ts`, then `notify-webhook/index.ts`, then the hook + `NotificationBell` (lucide `Bell`, gold count badge capped "9+", `DropdownMenu` list, item click → `navigate(\`/app/${slug}/ticket/${ticketId}\`)`, empty state "No one waiting").
- [ ] **Step 4:** Settings: add input `GoHighLevel webhook URL` (placeholder `https://services.leadconnectorhq.com/hooks/...`), inline error when non-empty and `!isValidWebhookUrl` (copy the helper into `src/lib/` — frontend must not import from `supabase/functions`), saved through the extended RPC.
- [ ] **Step 5:** Add `public/notify.mp3` (short ≤1s chime, ≤20KB).
- [ ] **Step 6:** `npx vitest run` → PASS; `npm run build` → succeeds.
- [ ] **Step 7:** Commit `feat(notify): staff bell across admin + GoHighLevel webhook events`.

---

### Task 7: Suggestions forum (public + admin)

**Files:**
- Create: `src/lib/suggestions.ts`, `src/lib/suggestions.test.ts`
- Create: `src/pages/Suggestions.tsx` (public), `src/pages/AdminSuggestions.tsx`
- Modify: `src/App.tsx` (routes `/support/:orgSlug/suggestions` public; `/app/:orgSlug/suggestions` under `OrgProtectedRoute` all roles)
- Modify: `src/components/AppShell.tsx` nav (item "Suggestions", lucide `Lightbulb`, allow all four roles)
- Modify: `src/components/PortalHeader.tsx` (link "Suggestions" → `/support/<slug>/suggestions`)

**Interfaces:**
- Consumes: Task 1 RPCs and table.
- Produces:
  - `SUGGESTION_CATEGORIES = ["App","System","Service","Other"] as const`, `SUGGESTION_STATUSES = ["Under review","Planned","In progress","Done","Declined"] as const`
  - `suggestionSchema` (zod): `name` 1-100, `email` email, `title` 3-140, `description` 1-4000, `category` enum.
  - `mapSuggestionError(e: { message?: string }): string` — `"rate_limited"` → "You've posted 5 suggestions today. Please try again tomorrow."; anything else → "Couldn't save your suggestion. Please try again."
  - `getVoterEmail(): string | null` / `setVoterEmail(email: string): void` — localStorage key `hv-voter-email`, try/catch.
  - Admin mutations write directly to `suggestions` (`status`, `is_hidden`, delete) via RLS.

- [ ] **Step 1: Write failing tests** `suggestions.test.ts`:
  ```ts
  expect(suggestionSchema.safeParse({ name: "A", email: "a@x.com", title: "ab", description: "d", category: "App" }).success).toBe(false); // title < 3
  expect(suggestionSchema.safeParse({ name: "A", email: "a@x.com", title: "Dark mode", description: "d", category: "Billing" }).success).toBe(false);
  expect(mapSuggestionError({ message: 'rate_limited' })).toBe("You've posted 5 suggestions today. Please try again tomorrow.");
  localStorage.setItem("hv-voter-email", "a@x.com"); expect(getVoterEmail()).toBe("a@x.com");
  ```
- [ ] **Step 2:** `npx vitest run src/lib/suggestions.test.ts` → FAIL.
- [ ] **Step 3:** Implement `suggestions.ts`.
- [ ] **Step 4:** Public page: Top/New toggle (default Top), status filter (All + statuses), cards (`.glass`, gold vote button with count, status badge colored: Under review cyan, Planned violet, In progress gold, Done green, Declined muted), "Suggest an improvement" dialog with the schema-validated form. Upvote: asks for email once if `getVoterEmail()` null, optimistic +1, revert and toast on RPC error, disable the button after voting in this session.
- [ ] **Step 5:** Admin page: table (title, author name + email, category, votes, status `Select`, hidden `Switch`, delete with `AlertDialog` confirm). Agents can change status/hidden; delete only shown for owner/admin (`role` from `useOrganization`).
- [ ] **Step 6:** `npx vitest run` → PASS; `npm run build` → succeeds.
- [ ] **Step 7:** Commit `feat(forum): public suggestions board with votes and admin moderation`.

---

### Task 8: Restyle remaining pages

**Files:**
- Modify: `src/pages/Index.tsx`, `src/components/HeroSection.tsx`, `src/components/Header.tsx`, `src/components/FAQSection.tsx`
- Modify: `src/pages/Login.tsx`, `src/pages/Signup.tsx`, `src/pages/InviteAccept.tsx` (remove theme toggle buttons)
- Modify: `src/pages/SupportPortal.tsx`, `src/components/TicketForm.tsx`, `src/pages/TicketSubmitted.tsx`, `src/pages/TicketChat.tsx`, `src/components/PortalHeader.tsx`
- Modify: `src/components/AppShell.tsx` (sidebar `.glass`, active nav item cyan glow), `src/pages/AdminDashboard.tsx`, `TicketDetails.tsx`, `Analytics.tsx`, `CannedResponses.tsx`, `Team.tsx`, `Settings.tsx` (cards → `.glass`)
- Modify: `src/lib/chartColors.ts` (cyan, violet, gold, plus two derived tints)
- Modify: `src/components/ThemeProvider.tsx` (delete `setTheme`/toggle API once no caller remains)

**Interfaces:**
- Consumes: Task 4 classes only. No logic changes.

- [ ] **Step 1:** `grep -rn "useTheme\|setTheme\|Sun\b\|Moon\b" src` → remove every toggle; then simplify `ThemeProvider` to set `class="dark"` once.
- [ ] **Step 2:** Apply `.grid-bg` to page roots, `.glass` to cards/panels, `font-display` to `h1`/`h2`, gold primary buttons (via `--primary`), cyan focus rings (via `--ring`). Page fade-in: wrap page content in `motion.div` `initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}` respecting `useReducedMotion()`.
- [ ] **Step 3:** `npm run lint` and `npm run build` → no new errors; `npx vitest run` → PASS.
- [ ] **Step 4:** Manual pass at 375px and 1280px widths on every route listed above: no horizontal scroll, text readable, focus rings visible.
- [ ] **Step 5:** Commit `style: apply Cyber Neon redesign across all pages`.

---

### Task 9: End-to-end check and deploy runbook

**Files:**
- Create: `e2e/live-chat-handoff.spec.ts`
- Modify: `README.md` (replace "Applying the database migrations" section with the runbook below)

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1:** Write Playwright test: go to `/support/higherview` → open widget → click "Talk to an agent" → fill name "E2E Tester" + email `e2e+<timestamp>@example.com` → expect live header text matching `/LIVE · TICKET #/` → send "hello from e2e" → expect the message in the thread. Second context logged in as a staff fixture user (`E2E_STAFF_EMAIL` / `E2E_STAFF_PASSWORD` env) → `/app/higherview/dashboard` → bell badge count ≥ 1 → open item → message "hello from e2e" visible.
- [ ] **Step 2:** Run `npx playwright test e2e/live-chat-handoff.spec.ts` against the dedicated project once it exists. Until then, mark as pending in the commit message.
- [ ] **Step 3:** README runbook (exact order): create dedicated project → `supabase link --project-ref <ref>` → `supabase inspect db table-stats` must show no `public` tables → `supabase db push` → in SQL editor `select vault.create_secret('<https://ref.supabase.co>', 'project_url'); select vault.create_secret('<random 32+ chars>', 'notify_webhook_secret');` → `supabase secrets set ANTHROPIC_API_KEY=… PUBLIC_APP_URL=… RESEND_API_KEY=… NOTIFY_WEBHOOK_SECRET=<same random value>` → `supabase functions deploy` → update `.env` → run `supabase/tests/live_chat_suggestions_checks.sql` → run the e2e test.
- [ ] **Step 4:** Commit `test(e2e): live chat handoff; docs: deploy runbook`.

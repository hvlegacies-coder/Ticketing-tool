# Futuristic Support Desk — Design Spec

Date: 2026-10-20
Status: Approved in brainstorming, pending written-spec review

## Goal

Upgrade the multi-tenant support desk (Vite + React + shadcn + Supabase) with:

1. A Claude-powered AI chat widget on the public support portal.
2. AI → human handoff into a live customer↔staff chat, with an in-app bell notification and GoHighLevel webhook events.
3. A public suggestions forum for improving the app and system.
4. A futuristic "Cyber Neon + gold" visual redesign across the whole app.

Every feature is scoped per organization ("each server unique to them"): data is isolated by `organization_id` and enforced with RLS.

## Decisions (from brainstorming)

| Topic | Decision |
|---|---|
| Admin chat meaning | Live chat between customers and staff (not staff-only team chat) |
| Handoff | AI collects name + email → auto-creates ticket with transcript → live chat in widget |
| Staff notification | Bell icon with unread count in admin top bar on every page |
| External notification | Per-org GoHighLevel inbound webhook URL; events on agent request and every client message |
| Forum posters | Public customers, no login (name + email) |
| Forum moderation | Live immediately; staff can hide/delete and set status |
| Visual style | Cyber Neon (navy grid, cyan/violet glow) with gold for logo + primary buttons |
| Chat widget | Floating holographic window, bottom-right |
| AI model | `claude-opus-5-5`, effort `low` |
| Theme mode | Dark-only; light/dark toggle removed |

## 1. Live chat and agent handoff

### Existing pieces reused

- `chat_messages` table (`ticket_id`, `sender_type` in `client|support`, `sender_name`, `sender_email`, `message`, `is_read`, `created_at`).
- Public ticket chat page `/t/:token` (`TicketChat.tsx`, `ClientTicketMessages.tsx`).
- Anonymous ticket creation path in `TicketForm.tsx` (client-generated `id` and access token, to avoid RLS-on-RETURNING failure).
- Staff ticket messaging in `TicketMessages.tsx`.

### Schema changes

- `tickets.agent_requested_at TIMESTAMPTZ NULL` — set when a customer requests a human; cleared when the first `support` message is inserted (trigger on `chat_messages`).
- `organization_integrations.ghl_webhook_url TEXT NULL`.

### Customer flow (widget)

1. Gold "Talk to an agent" chip is always visible. Claude may also trigger handoff via tool (Section 2).
2. Widget shows an inline form: name, email (required, validated).
3. Widget creates a ticket via the existing anonymous path:
   - `issue_title`: "Live chat request"
   - `issue_category`: "Live Chat"
   - `issue_description`: AI transcript (role-labelled, truncated to 10,000 chars)
   - `company_name`: "—" if not given (column is NOT NULL)
   - `agent_requested_at`: now()
4. Widget switches to live mode: subscribes to `chat_messages` for that ticket via Supabase realtime and posts customer messages as `sender_type = 'client'`.
5. Widget shows the `/t/<token>` link so the customer can resume later. Ticket id + token kept in `sessionStorage` (wrapped in try/catch) so a page reload resumes the live chat.
6. System line "Agent <name> joined" appears when the first `support` message arrives.

### Staff flow

- `NotificationBell` component in `AppShell.tsx` top bar.
  - Count = tickets in org with `agent_requested_at IS NOT NULL` + `chat_messages` where `sender_type = 'client' AND is_read = false` for org tickets.
  - Dropdown lists items, newest first; click navigates to `/app/<slug>/ticket/<id>`.
  - Realtime subscription moves from `AdminDashboard.tsx` into the shell, filtered to the current org's tickets; toast + short sound on new item.
- Opening a ticket's messages marks client messages `is_read = true` (existing behaviour if present; add if not).

### GoHighLevel webhook

- New edge function `notify-webhook` (service role), invoked by a database webhook / trigger on:
  - `tickets` update where `agent_requested_at` goes from NULL to a value → event `agent_requested`
  - `chat_messages` insert where `sender_type = 'client'` → event `client_message`
- Payload:
  ```json
  {
    "event": "agent_requested | client_message",
    "org": { "id": "...", "slug": "...", "name": "..." },
    "ticket_id": "...",
    "customer_name": "...",
    "email": "...",
    "message": "...",
    "chat_url": "https://<origin>/t/<token>",
    "admin_url": "https://<origin>/app/<slug>/ticket/<id>",
    "created_at": "ISO-8601"
  }
  ```
- `<origin>` comes from a function secret `PUBLIC_APP_URL`.
- No URL configured → no-op. Non-2xx or timeout (5s) → log and return; never blocks chat.
- Settings page gets a "GoHighLevel webhook URL" field (owner/admin only), validated as `https://`.

## 2. Claude AI chatbot

### Edge function `support-chat` (rewrite)

- Uses `npm:@anthropic-ai/sdk`; key from Supabase secret `ANTHROPIC_API_KEY`.
- Request: `{ organizationId, messages: [{role, content}] }`.
- Model `claude-opus-5-5`, `output_config: { effort: "low" }`, `max_tokens: 2048`, adaptive thinking (default).
- Refusal fallback enabled: beta `server-side-fallback-2026-07-01`, `fallbacks: "default"`.
- System prompt: existing HigherView knowledge base (`DEFAULT_SYSTEM_PROMPT`), overridden per org by the `organization_integrations.ai_system_prompt_override` as today; `ai_chat_enabled = false` still disables the AI.
- Tool `request_human_agent` (`strict: true`, input `{ reason: string }`), `tool_choice: auto`; system prompt instructs Claude to call it when the customer asks for a person or Claude cannot resolve the issue.
- Response to widget: `{ reply: string, handoff: boolean }`. If Claude calls the tool, `handoff = true` and `reply` is a short confirmation.
- `stop_reason === "refusal"` (after fallback) → generic apology + `handoff: true`.
- Limits: max 30 messages per conversation, max 2,000 chars per message → 400 with friendly message.
- Errors (network, 429, 5xx) → 502 with `{ error }`; widget shows fallback text offering ticket form and agent.

### Widget `SupportChatWidget.tsx` (rebuild)

- Floating holo window: AI orb with gold ring, waveform "thinking" indicator, quick-action chips (Talk to an agent, Track refund, Upload docs).
- Keeps "Create ticket from conversation" (`onTicketDraft`).
- Two modes: `ai` and `live` (Section 1).

## 3. Suggestions forum

### Tables

```sql
suggestions (
  id uuid pk default gen_random_uuid(),
  organization_id uuid not null references organizations on delete cascade,
  author_name text not null check (length(author_name) between 1 and 100),
  author_email text not null check (author_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  title text not null check (length(title) between 3 and 140),
  description text not null check (length(description) between 1 and 4000),
  category text not null check (category in ('App','System','Service','Other')),
  status text not null default 'Under review'
    check (status in ('Under review','Planned','In progress','Done','Declined')),
  is_hidden boolean not null default false,
  vote_count integer not null default 0,
  created_at timestamptz not null default now()
)

suggestion_votes (
  suggestion_id uuid not null references suggestions on delete cascade,
  voter_email text not null,
  created_at timestamptz not null default now(),
  primary key (suggestion_id, voter_email)
)
```

- Trigger keeps `vote_count` in sync on vote insert.
- Rate limit: insert trigger rejects a 6th suggestion from the same `author_email` + org within 24h.

### Access

- Public read via `SECURITY DEFINER` RPC `get_public_suggestions(_slug text, _sort text)` returning visible rows without `author_email`.
- Public write via RPCs `create_suggestion(...)` and `vote_suggestion(_id uuid, _email text)` (vote is idempotent: `on conflict do nothing`).
- Direct table access: org members (`has_org_role` any role) can select; owner/admin/agent can update `status`/`is_hidden`; owner/admin can delete. Anon has no direct table grants.

### UI

- Public `/support/:orgSlug/suggestions`: list with Top/New sort and status filter, post form, upvote button; voter email remembered in `localStorage` (try/catch).
- Admin `/app/:orgSlug/suggestions` (sidebar item, all roles view; owner/admin/agent moderate): table with status select, hide toggle, delete, author email visible.

## 4. Redesign

- Rewrite theme tokens in `src/index.css` (`:root` becomes the dark neon palette; remove the separate light set):
  - background navy `#070b1a`, card `rgba(10,18,40,.85)`, border cyan `#00e5ff` at low alpha, ring cyan, accent violet `#a855f7`, primary gold `#d4a017 → #f5d26b`.
- Update `bg-gradient-hero` / `bg-gradient-gold` in `tailwind.config.ts`; add utilities `.glass`, `.grid-bg`, `.glow-cyan`, `.glow-gold`.
- Headings font: Orbitron (Google Fonts); body stays Inter.
- Remove theme toggle buttons (Login, Signup, AppShell, others) and force dark in `ThemeProvider`.
- Hover glow on buttons/cards; page fade-in via existing `framer-motion`.
- WCAG AA contrast for text on panels; `prefers-reduced-motion` disables glow pulses, waveform and fade-ins.
- Applies to: landing, login/signup, support portal, ticket chat, suggestions, all admin pages.

## Testing

- Vitest:
  - handoff response parsing (`handoff` flag from tool call / refusal),
  - webhook payload builder,
  - suggestion input validation helpers.
- SQL checks (run against a local/branch DB): cross-org isolation for `chat_messages`, `suggestions`; anon cannot read `author_email`; vote uniqueness; 24h post limit.
- Playwright: portal → AI chat → "Talk to an agent" → name/email → ticket created → live message → staff bell count increments.

## Build order (one commit per step)

1. Migrations: `agent_requested_at`, clear-on-first-reply trigger, `ghl_webhook_url`, suggestions tables/RPCs/RLS.
2. `support-chat` Claude rewrite.
3. Widget rebuild with live mode + handoff; `NotificationBell` in shell.
4. `notify-webhook` function + DB triggers + Settings field.
5. Suggestions public + admin pages.
6. Visual redesign.

## Out of scope

- Staff-only team chat, DMs, channels.
- Email / browser push notifications (GHL handles outbound notifications).
- Comments on suggestions.
- Light theme.

## Prerequisites from the owner

- `ANTHROPIC_API_KEY` set as a Supabase secret (never in chat or git).
- `PUBLIC_APP_URL` secret for webhook links.
- Supabase Auth service restored (currently returning 503) to test admin flows.

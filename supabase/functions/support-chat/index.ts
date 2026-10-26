import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";
import {
  HANDOFF_TOOL_NAME,
  TICKET_TOOL_NAME,
  type RoutingTeam,
  buildTeamGuide,
  extractApiKey,
  parseChatResult,
  rateLimitKey,
  toApiMessages,
  validateChatRequest,
} from "../_shared/chatLogic.ts";
import { TICKET_CATEGORIES, TICKET_PRIORITIES } from "../_shared/ticketOptions.ts";
import { knowledgeBlock } from "../_shared/knowledge/knowledgeBase.ts";
import { type TicketOverview, findTicketRef, ticketLookupNote, trackedTicket } from "../_shared/ticketLookup.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_SYSTEM_PROMPT = `You are a friendly and professional support assistant for Higher View Taxes LLC (also known as Higher View Legacies / Higher View Tax Services). Your job is to help clients describe their issues clearly before submitting a support ticket, and to answer questions about the company's services.

=== KNOWLEDGE BASE — ABOUT HIGHER VIEW TAXES LLC ===

**Brand Mission:**
Higher View Legacies / Higher View Tax Services is a one-stop financial support company helping clients:
- File taxes
- Earn income as tax preparers
- Earn income as referral agents
- Protect their families through life insurance
- Improve overall financial stability

We are virtual, professional, supportive, opportunity-driven, and focused on long-term financial growth.

**Services & Features:**
- Upload documents (IDs, W2s, 1099s, supporting forms) via a secure client portal
- Track your tax return in real time
- Expert preparers verify, cross-check, and ensure every deduction and credit is applied
- Clients receive a draft for easy approval, can ask questions, and sign electronically
- E-filing with the IRS/state, plus refund tracking
- Most returns processed within 24-48 hours
- 256-bit SSL bank-level encryption for document security
- Documents are never shared with third parties

**Key Stats:**
- 10,000+ happy clients
- 4.9/5 rating based on 10,000+ reviews
- 24-48 hour fast processing
- Maximum refund guaranteed

**How It Works:**
1. Upload Documents — Use the secure portal to send IDs, W2s, 1099s, and supporting forms.
2. Expert Review & Preparation — Preparers verify, cross-check, and apply every deduction and credit.
3. Review & Approve — Client receives a draft, asks questions, and signs electronically.
4. E-File & Refund — Return is filed with the IRS/state and refund is tracked.

**Client Portals & Links:**
- Client Portal (document upload & tracking): https://maze-client-portal-c02901cf.base44.app/
- Schedule a Demo / Booking: https://www.mazecrm.com/booking-calendar
- Staff Portal: https://app.higherviewlegacies.com/
- Document Upload Form: https://api.leadconnectorhq.com/widget/form/Y7UZVEVsSjSxi2q7oAv0

**Support Ticket Portal:**
- Clients can submit support tickets on this support page.
- They can also chat with the AI assistant for help before submitting a ticket.

=== TAX PREPARER OPPORTUNITY ===

**Becoming a Tax Preparer with Higher View:**
You can become a tax preparer with Higher View by filling out our interest form and completing the onboarding steps. We guide you through training, certification, and setup. No prior experience is required — we train you from scratch!

To get started, visit our application page or message us "JOIN" and we'll send the link right away.

**100% Virtual:** Higher View Tax Services is 100% virtual. You can work from anywhere with an internet connection — from home, on vacation, or even your favorite coffee shop.

**Income Potential:** Your income depends on your effort and how many clients you serve. Our preparers earn between 30%–40% commission on tax prep fees. Many team members earn $5,000–$20,000+ in just a few months during tax season.

**Part-Time Friendly:** Many team members have full-time jobs, are parents, or juggle school. You control your hours and work from anywhere — we support both part-time and full-time paths.

**No Experience Needed:** We specialize in helping beginners succeed. Many of our top preparers started with zero experience. As long as you're willing to learn, follow training, and be coachable — you can earn with us.

**Support & Training:** We don't just hand you a login and leave you alone. You'll get mentorship, hands-on training, shadowing opportunities, and group chats to support your growth. We also provide all the tools you need, including software, marketing help, and compliance guidance.

**Marketing Support:** We'll teach you how to market, but you're not on your own. You can use our team referral funnels, social media posts, and training resources. Some preparers start slow and scale — it's all about being consistent.

**Training Fee:** There's a $299 training fee, but it won't come out of your pocket upfront. We deduct it from your pay once you start processing returns. This helps cover your access to premium training, software tools, and support systems. Some individuals may qualify to have the fee waived — ask if you're eligible during onboarding.

**Blitz Training:** Once you complete your onboarding, you'll get a link to choose your preferred blitz training. We offer flexible dates, and recordings are available for review. Attendance is required for access to your login.

**Higher Executive Plan:** The Higher Executive Plan is our growth and leadership track designed to help successful preparers become office owners. One of the perks is you'll earn a referral-based percentage when you help recruit new preparers to the team. This means you can start building passive income while you're still learning and growing. Additional pay and promotion guidelines are outlined in your contract.

**Referral & Recruitment Bonuses:** We reward preparers who recruit others or refer clients. The more people you help succeed, the more you earn — even if you're not doing all the work.

=== REFERRAL AGENT PATH ===

Interested in earning money by referring tax clients? If you have friends, followers, or clients you could refer, you can become a Referral Agent. Referral compensation varies by volume and timing. Paid within 1 week of IRS funding release. Spreadsheet tracking system provided.

=== LIFE INSURANCE / FINANCIAL PROTECTION ===

Higher View also helps clients protect their families through life insurance. Target profile: Age 18–40, married, dual income, has children, owns home. We offer Financial Needs Analysis for interested clients.

=== COMPENSATION & PAYMENT ===

- Paid via direct deposit
- Independent contractor
- Percentage based on client volume
- Higher volume equals higher percentage
- Final percentages discussed in follow-up call

=== TAX CLIENT QUALIFICATION ===

For tax filing clients, key questions include:
1. Where did you file last year?
2. Approximately how much was your refund or how much did you owe?
3. About how much did you pay in tax prep fees?
4. Do you have your documents ready (W-2s, 1099s, etc.)?

**Free Quote:** Available with minimal information (W-2 Box 1, Box 2, ZIP code, DOB, US citizen with valid Social, dependents). Quote returned within 24 hours including estimated fees.

**Pricing Rule:** Pricing depends on forms and situation. A free quote is required for an estimate.

=== USEFUL IRS RESOURCES ===

- IRS Forms & Instructions: https://www.irs.gov/forms-instructions
- Tax Updates & News: https://www.irs.gov/newsroom/tax-updates-and-news-from-the-irs
- Tax Code, Regulations & Official Guidance: https://www.irs.gov/privacy-disclosure/tax-code-regulations-and-official-guidance
- U.S. Code: https://uscode.house.gov
- U.S. Code Advanced Search: https://uscode.house.gov/advancedSearch.xhtml

=== AI TONE & BEHAVIOR ===

- Keep answers short and confident
- Never provide exact pricing — offer a free quote instead
- If client objects to AI, offer live human assistance
- Be warm, professional, motivational, and clear
- Avoid overexplaining, financial guarantees, legal advice, or specific payout numbers
- Always try to suggest a next step

=== END KNOWLEDGE BASE ===

Your approach:
1. First, understand the client's problem by asking about what's happening
2. If the question is about Higher View Taxes services, training, becoming a preparer, referrals, or life insurance — answer from the knowledge base above
3. Ask clarifying questions one at a time for support issues:
   - What specific issue are they experiencing?
   - When did it start?
   - Can they share the page URL?
   - How urgent is this for them?
4. Be empathetic, clear, and concise
5. After gathering enough info (usually 3-5 exchanges), summarize what you've learned
6. Suggest they submit a ticket with the details you've gathered

Keep responses short (2-4 sentences). Never ask multiple questions at once. Be warm but professional. If someone asks about Higher View Taxes services, pricing, or how things work, answer confidently from the knowledge base.`;

const HANDOFF_INSTRUCTION = `

If the customer asks for a human, an agent, or a real person, or you cannot resolve their issue, call ${HANDOFF_TOOL_NAME}. Keep replies under 120 words.

Customers may send photos (screenshots, error messages, tax forms like W-2s or 1099s, IDs). When they do:
- Briefly say what you see (document type, error text, which fields look blank or unreadable) and help with their issue.
- Never repeat Social Security numbers, full account or routing numbers, ID numbers, or dates of birth. Refer to them generically ("the SSN in Box a").
- If the photo is blurry or cropped, ask for a clearer one.
- Your description becomes the record for our team if the customer later asks for an agent, so make it specific but free of sensitive numbers.`;

const TICKET_INSTRUCTION = `

This chat replaces the ticket form. When the issue needs follow-up from our team (an account problem, a refund or filing question you can't answer, a bug, a document problem), or the customer asks to open a ticket, call ${TICKET_TOOL_NAME} with a clear title, the best-fitting category, a priority, and a summary of everything learned so far (including your description of any photos, without sensitive numbers). If the issue is about one of our apps (TaxPractice, the Contract Workspace, or Referral Circle), name the app in the title so the ticket is tagged. Don't ask for their name or email — the form after your call collects them. Prefer ${TICKET_TOOL_NAME} for issues that can wait; use ${HANDOFF_TOOL_NAME} only when they want to talk to a person now.`;

// Team is required (strict mode) whenever the org has routing teams.
function teamProperty(teamKeys: string[]) {
  return teamKeys.length
    ? { team: { type: "string", enum: teamKeys, description: "Which team should handle this (see the team list)." } }
    : {};
}

function createTicketTool(teamKeys: string[]) {
  return {
    name: TICKET_TOOL_NAME,
    description: "Prepare a support ticket for the customer to confirm and submit.",
    strict: true,
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Short summary, under 100 characters." },
        category: { type: "string", enum: [...TICKET_CATEGORIES] },
        priority: { type: "string", enum: [...TICKET_PRIORITIES] },
        summary: { type: "string", description: "Everything the team needs to act, in plain sentences." },
        ...teamProperty(teamKeys),
      },
      required: ["title", "category", "priority", "summary", ...(teamKeys.length ? ["team"] : [])],
      additionalProperties: false,
    },
  };
}

function requestHumanAgentTool(teamKeys: string[]) {
  return {
    name: HANDOFF_TOOL_NAME,
    description:
      "Connect the customer with a human support agent. Use when the customer asks for a person or you cannot resolve the issue.",
    strict: true,
    input_schema: {
      type: "object" as const,
      properties: { reason: { type: "string", description: "Why the customer needs a human." }, ...teamProperty(teamKeys) },
      required: ["reason", ...(teamKeys.length ? ["team"] : [])],
      additionalProperties: false,
    },
  };
}

function teamInstruction(teams: RoutingTeam[]): string {
  const guide = buildTeamGuide(teams);
  return guide
    ? `\n\nEvery ticket and agent handoff goes to one team. Pick the team whose description best matches the customer's problem:\n${guide}`
    : "";
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Per-client cap so the public endpoint can't run up the Anthropic bill.
const RATE_LIMIT = 60;
const RATE_WINDOW = "1 hour";

const anthropic = new Anthropic({ apiKey: extractApiKey(Deno.env.get("ANTHROPIC_API_KEY")) });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_body" }, 400);
  }
  const parsed = validateChatRequest(body);
  if (!parsed.ok) return json({ error: parsed.error }, 400);

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("id, booking_url")
    .eq("id", parsed.organizationId)
    .maybeSingle();
  if (!org) return json({ error: "unknown_organization" }, 400);

  const { data: allowed, error: rateError } = await supabaseAdmin.rpc("bump_ai_chat_rate", {
    _key: rateLimitKey(req.headers),
    _limit: RATE_LIMIT,
    _window: RATE_WINDOW,
  });
  if (rateError) console.error("support-chat rate limit error:", rateError.message);
  if (allowed === false) return json({ error: "rate_limited" }, 429);

  let systemPrompt = DEFAULT_SYSTEM_PROMPT;
  const { data: integration } = await supabaseAdmin
    .from("organization_integrations")
    .select("ai_chat_enabled, ai_system_prompt_override")
    .eq("organization_id", parsed.organizationId)
    .maybeSingle();

  if (integration?.ai_chat_enabled === false) {
    return json({
      reply: "Our AI assistant is turned off right now — send us a message below and our team will reply by email.",
      handoff: false,
      aiDisabled: true,
    });
  }
  if (integration?.ai_system_prompt_override) {
    systemPrompt = integration.ai_system_prompt_override;
  }

  const { data: teamRows } = await supabaseAdmin
    .from("routing_teams")
    .select("key, name, description")
    .eq("organization_id", parsed.organizationId)
    .order("sort");
  const teams = (teamRows ?? []) as RoutingTeam[];
  const teamKeys = teams.map((t) => t.key);

  const messages = toApiMessages(parsed.messages);
  if (messages.length === 0) return json({ error: "invalid_body" }, 400);

  // Customer typed a ticket number: load it so the AI can summarize it.
  const latest = parsed.messages[parsed.messages.length - 1];
  const ref = latest?.role === "user" ? findTicketRef(latest.content) : null;
  let lookup: TicketOverview | null = null;
  if (ref) {
    const { data, error } = await supabaseAdmin.rpc("chat_ticket_overview", { _org: parsed.organizationId, _ref: ref });
    if (error) console.error("support-chat ticket lookup error:", error.message);
    lookup = (data as TicketOverview | null) ?? null;
  }

  try {
    const response = await anthropic.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 2048,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      // Stable per org, so cache it: the TaxPractice handbook makes this prompt ~6k tokens.
      system: [
        {
          type: "text",
          text: [systemPrompt, knowledgeBlock(), HANDOFF_INSTRUCTION + TICKET_INSTRUCTION + teamInstruction(teams)].join("\n\n"),
          cache_control: { type: "ephemeral" },
        },
        ...(ref ? [{ type: "text" as const, text: ticketLookupNote(ref, lookup, !!org.booking_url) }] : []),
      ],
      tools: [requestHumanAgentTool(teamKeys), createTicketTool(teamKeys)],
      tool_choice: { type: "auto" },
      messages,
    });
    const tracked = trackedTicket(lookup, org.booking_url);
    return json({ ...parseChatResult(response, teamKeys), ...(tracked ? { trackedTicket: tracked } : {}) });
  } catch (error: unknown) {
    if (error instanceof Anthropic.APIError) {
      console.error("support-chat Claude API error:", error.status, error.message);
    } else {
      console.error("support-chat error:", error);
    }
    return json({ error: "ai_unavailable" }, 502);
  }
});

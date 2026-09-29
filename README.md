# AI-Powered Customer Support Refund System

A full-stack refund processing app: customers submit refund requests through a
chat-style interface, a deterministic policy engine decides the outcome, and an
LLM assists with classification and writes the customer-facing reply. An admin
dashboard shows every decision with a full audit trail.

Built for the WORKNOON Full Stack Engineer take-home assessment.

## Stack

- **Frontend:** React + Vite + TypeScript, shadcn/ui, Zustand, Tailwind
- **Backend:** NestJS + TypeScript, Prisma ORM
- **Database:** PostgreSQL
- **AI:** Google Gemini (free tier) or Groq (free tier), behind a swappable
  provider interface, with a deterministic mock provider as the default so the
  app runs with zero API keys
- **Infra:** Docker Compose (db + backend + frontend, single command)

## Quick start

```bash
git clone <this-repo>
cd refund-support
cp .env.example .env
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001/api
- The database is seeded automatically on first boot with 15 customers and
  order histories covering every policy edge case (final sale, over $500,
  outside the return window, already refunded, repeat-refund pattern, etc.)
  On `/`, the "load a sample order" dropdown lists all of them.

No API key is required to run the app — `LLM_PROVIDER=mock` is the default
and uses a deterministic keyword classifier and template replies instead of a
live model, so the full flow (including the admin dashboard and audit trail)
works out of the box.

### Using a real LLM

Get a free key from one of:
- **Gemini:** https://aistudio.google.com/apikey (no card required)
- **Groq:** https://console.groq.com/keys

Then in `.env`:
```env
LLM_PROVIDER=gemini
GEMINI_API_KEY=your-key-here
```
or
```env
LLM_PROVIDER=groq
GROQ_API_KEY=your-key-here
```
Restart with `docker compose up --build backend`.

### Resetting the database
```bash
docker compose down -v
docker compose up --build
```

## Architecture

```
+-------------+      +--------------------------------+      +----------+
|  Frontend   |----->|  Backend (NestJS)               |----->| Postgres |
|  React/     | /api |  RefundsService:                |      | (Prisma) |
|  shadcn     |<-----|   1. sanitize + screen           |<-----|          |
+-------------+      |   2. verify order                |      +----------+
                      |   3. AI classification ---------+----> LLM provider
                      |   4. policy engine (rules)       |      (Gemini/Groq/
                      |   5. reconcile                   |       mock)
                      |   6. AI writes reply             |
                      |   7. save + audit log            |
                      +--------------------------------+
```

### Backend modules

- **`policy/`** — deterministic rules engine (`policy.engine.ts`). Pure
  function, no I/O, fully unit-testable. This is the single source of truth
  for decisions.
- **`llm/`** — `LlmProvider` interface with three implementations
  (`GeminiProvider`, `GroqProvider`, `MockProvider`), selected at runtime via
  `LLM_PROVIDER`. All model output is validated against a schema before use.
- **`security/`** — input sanitization and a prompt-injection pattern screen,
  run before anything touches the database or the LLM.
- **`refunds/`** — orchestrates the flow above and persists results.
- **`orders/`** — read-only demo endpoint listing seeded orders, so testers
  know which email/order-number pairs to try.

### Data model (Prisma)

`Customer` → `Order` → `OrderItem` (with an `isFinalSale` flag), plus
`RefundRequest` and `AuditLog`. Every refund request stores a step-by-step
audit trail (input screening, order lookup, history lookup, AI analysis,
policy evaluation with each rule's pass/fail/flag, and reply generation),
visible in the admin dashboard's detail view.

## How AI integration works

**The rules engine is the decision authority. The LLM is advisory only.**

1. The customer's message is sanitized and screened for prompt-injection
   patterns (instruction overrides, fake authority claims, role reassignment,
   delimiter injection, etc.) *before* it goes anywhere near the model.
2. If the message is clean and the order is verified, the LLM classifies the
   claim type (damaged, wrong item, change of mind, etc.) and extracts which
   SKUs the customer means. It does **not** decide approve/deny.
3. The deterministic policy engine (`policy.engine.ts`) evaluates the request
   against the refund policy (see `docs/refund-policy.md`) using the AI's
   classification as one input among several (order data, refund history,
   claim type).
4. **Reconciliation:** if the AI separately flags the request as suspicious,
   the system can only make the outcome *more* cautious (e.g. downgrade an
   Approved to Escalated) — never the reverse. The AI cannot approve or
   unlock a refund the rules engine denied.
5. Only after the decision is final does the LLM write the customer-facing
   reply, constrained to the decision and reason it's given — it can't
   invent policy, promise dates, or include links (validated in
   `llm/validate.ts`).
6. If the LLM call fails, times out, or returns malformed output, the system
   falls back to a keyword-based classifier and a template reply. The
   decision is unaffected, and the audit log records that the fallback fired.

### Prompt-injection safeguards

- Untrusted customer text is wrapped in delimiter tags and explicitly
  labeled as data, never as instructions, in every prompt.
- A regex-based pre-filter catches common injection patterns ("ignore
  previous instructions", "you are now...", fake admin/authority claims,
  attempts to break out via markup) and escalates automatically without
  ever sending the message to the LLM.
- Model responses are parsed as strict JSON against an allow-listed schema;
  anything else is rejected and the fallback path is used.
- The LLM is never given the ability to call any tool, run a query, or
  affect the database — it only returns classification/text.

## Assumptions & trade-offs

- **No authentication** on the admin dashboard or the API — out of scope for
  this assessment, but in production the `/admin` routes and
  `GET`/`POST /api/refunds*` would sit behind auth.
- **Schema sync via `prisma db push`** rather than committed migrations, to
  keep `docker compose up` to a single command with no manual migration
  step. In production, committed migrations (`prisma migrate deploy`) would
  be used instead.
- **Refund policy thresholds are illustrative defaults** (30-day return
  window, $500 human-review threshold, 3-refunds-in-60-days flag) — see
  `docs/refund-policy.md` for the full list and rationale. They're centralized
  in `policy.constants.ts` and easy to change.
- **Free-tier LLMs** were used intentionally per the assessment's scope
  (Gemini AI Studio / Groq), both behind a common interface so swapping to
  OpenAI/Anthropic/etc. is a one-file change.
- **Demo orders endpoint** (`GET /api/orders/demo`) exposes seeded synthetic
  data to make testing easy; would be removed or gated in production.
- **Polling instead of websockets** for the admin dashboard's live updates
  (5s interval) — simpler for the assessment's scope; a real-time system
  would likely use SSE or websockets instead.

## Refund policy

Full policy text and implementation notes: [`docs/refund-policy.md`](./docs/refund-policy.md)

## Project structure

```
backend/
  prisma/              # schema + seed data
  src/
    policy/            # deterministic rules engine
    llm/               # LLM provider interface + implementations
    security/          # sanitization + injection screening
    refunds/           # orchestration, controller, DTOs
    orders/             # demo/health endpoints
frontend/
  src/
    pages/             # ChatPage (customer), AdminPage
    components/        # DecisionBadge + shadcn/ui components
    store/              # Zustand stores (chat, admin)
    lib/api.ts          # typed fetch client
docs/
  refund-policy.md      # business rules, source of truth for the policy engine
docker-compose.yml
```
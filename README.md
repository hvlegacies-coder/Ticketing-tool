# Client Connect

A multi-tenant support ticketing CRM: each business gets its own branded
support portal, AI intake assistant, SLA tracking, team roles, tags, canned
responses, and analytics — isolated from every other tenant at the database
level (Postgres Row-Level Security).

## Deploying to a Supabase project

Use a **dedicated** project — never one that already hosts another app
(these migrations create `public.profiles` and an `auth.users` trigger).

1. Link and confirm the project is empty:
   ```sh
   npx supabase login
   npx supabase link --project-ref <REF>
   npx supabase inspect db table-stats   # must list no public.* tables
   ```
2. Apply the schema:
   ```sh
   npx supabase db push
   ```
3. In the SQL editor, create the Vault secrets the webhook triggers use
   (`<SECRET>` = a random string of 32+ characters):
   ```sql
   select vault.create_secret('https://<REF>.supabase.co', 'project_url');
   select vault.create_secret('<SECRET>', 'notify_webhook_secret');
   ```
4. Set edge function secrets (same `<SECRET>` as step 3):
   ```sh
   npx supabase secrets set ANTHROPIC_API_KEY=<key> PUBLIC_APP_URL=https://<your-app-domain>      RESEND_API_KEY=<key> NOTIFY_WEBHOOK_SECRET=<SECRET>
   ```
5. Deploy functions:
   ```sh
   npx supabase functions deploy
   ```
6. Point the app at the project: update `VITE_SUPABASE_PROJECT_ID`,
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env`, and
   `project_id` in `supabase/config.toml`.
7. Verify the database rules (runs in a transaction and rolls back):
   ```sh
   psql "<DB_URL>" -v ON_ERROR_STOP=1 -f supabase/tests/live_chat_suggestions_checks.sql
   ```
8. Sign up, create your organization, then run the end-to-end check:
   ```sh
   E2E_ORG_SLUG=<slug> E2E_STAFF_EMAIL=<you> E2E_STAFF_PASSWORD=<pw> npx playwright test
   ```

Optional: in **Settings → Integrations**, paste a GoHighLevel inbound webhook
URL to receive `agent_requested` and `client_message` events.

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

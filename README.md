# Client Connect

A multi-tenant support ticketing CRM: each business gets its own branded
support portal, AI intake assistant, SLA tracking, team roles, tags, canned
responses, and analytics — isolated from every other tenant at the database
level (Postgres Row-Level Security).

## Applying the database migrations

This repo's `supabase/migrations` includes the multi-tenant schema (organizations,
roles, SLA policies, tags, canned responses, internal notes, audit log, and the
token-gated client portal). They have **not** been applied to the live Supabase
project yet. To apply them:

```sh
npx supabase login
npx supabase link --project-ref nflptacvayfbdpalkdbl
npx supabase db push
```

Review the migrations first — in particular
`20260723190100_tickets_multi_tenant.sql`, which backfills existing tickets into
a default "HigherView Legacies" organization owned by the earliest existing
support-staff account.

After migrating, existing support-staff logins need to switch from the old
username-style sign-in to a real email + password (see `src/pages/Login.tsx`) —
migrate their `profiles` email or have them sign up fresh and get invited into
the backfilled organization from **Team → Invite**.

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

# TaxPractice Support Knowledge Base

Support handbook for tickets about the TaxPractice training simulator and its return checker: who can do what, how each feature works, the exact error messages people see, and the fix for each.

- App: TaxPractice (Tax Practice Simulator)
- Sign-in: tax-practice-simulator-l5mh.vercel.app
- Owner: Higher View Legacies (administrator)
- Tax year: 2025 forms

## What the app is

TaxPractice is a **training simulator for tax preparers**. It generates fully fictional client scenarios — a taxpayer, every supporting document (W-2, 1099s, Schedule C worksheet, 1098-T and more), preparer tasks and a line-by-line answer key — so preparers can practise entering returns without touching real taxpayer data.

- Every person, employer and identifier in a scenario is fictional. Every generated page is watermarked **TRAINING SAMPLE — NOT FOR FILING**.
- All numbers and the answer key come from a tested tax calculator, never from AI. AI only helps describe a scenario.
- The forms and answer keys are for tax year **2025**.

**What it is not.** It is not filing software. It does not e-file, does not prepare real returns, and does not connect to any tax software or client records.

One feature handles real documents: the Return checker, for office and admin accounts. It checks a return someone already prepared, entirely inside the user's browser.

## Account types and what each can do

Every login belongs to one of three types. The header shows it after sign-in: the office name and role (for example "Smile Tax Services · office"), or "Administrator".

| Can they… | Admin | Office | Preparer |
| --- | --- | --- | --- |
| See their office's scenarios + built-in scenarios | All offices | Yes | Yes |
| Generate new scenarios | Yes (become built-in) | Yes (for their office) | No |
| Save scenarios | Automatic | Save button | No |
| Delete scenarios | Any | Their office's only | No |
| See the answer key | Always | Always | After all preparer tasks are ticked |
| Download documents as PDF | Yes | No | No |
| Use the scenario assistant (AI) | Yes | Yes | No |
| Return checker (real returns) | Yes | Yes | No |
| Scan & organize (training documents) | Yes | Yes | Yes |
| Team page (preparer link) | — | Yes | No |
| Admin page (offices, logins, passwords) | Yes | No | No |

- **Admin** belongs to no office and manages everything.
- **Office** is the office owner's login (one office can have more than one office login).
- **Preparer** is the office's trainees. All preparers of an office share one login, opened through the office's preparer link.

Pages a role can't use are hidden; if someone types the address anyway, they are sent back to Scenarios, and the server refuses the action with "Your account can't do that."

## Signing in

### Office and admin accounts

1. Open the site. Every page sends you to **Sign in**.
2. Enter the email and password the administrator gave you. Press **Continue**.

### Preparers

1. Open the link the office sent (it looks like …vercel.app/login/<long code>).
2. Enter only the password the office gave with the link. The page says **Preparer sign-in**.

### Things that are by design

- **No sign-up.** Only the administrator creates office logins; offices create the preparer link.
- **No "forgot password".** Office passwords are reset only by the administrator (Admin page → Reset password). The preparer link password is changed by the office on its Team page.
- **No welcome email from the app.** Logins and links are sent to people separately (by the administrator's own messaging).
- **No "Sign in with Google" in this app.** A few logins also belong to the owner's other app (Referral Circle). Those people sign in here with their Referral Circle email and that app's password; if they only ever used Google there, the administrator sets a password for them.
- **Staying signed in.** Sessions persist in the browser until **Sign out** (top right).

## Scenarios

A scenario is one fictional client: household, income, every document, preparer tasks and an answer key. The **Scenarios** page lists two groups.

| Group | Who made it | Who sees it | Who can delete it |
| --- | --- | --- | --- |
| **[Office name] scenarios** | That office's office account | Only that office (office + its preparers) | That office, or the admin |
| **Built-in scenarios** | The admin (plus the bundled demos) | Every office and preparer | The admin only (bundled demos can't be deleted) |

### Generating a scenario (office and admin)

1. Click **New scenario**. Pick a template (Beginner → Expert), describe the client, or talk it through with the assistant, then fine-tune.
2. Click **Generate scenario**. If it says **Loading your account…**, wait a second; it enables itself.
3. **Office:** the scenario opens with a **Not saved yet** notice and an **Unsaved** badge in the list. Click **Save scenario** so the office and its preparers can open it. Unsaved scenarios are gone after a reload, and the browser warns before leaving the page.
4. **Admin:** the scenario is saved straight into the built-in scenarios for everyone.

### Other actions

- **Generate a variant** — same setup, different fictional people and numbers.
- **Seed** — the scenario's code; the same setup and seed always produce exactly the same scenario.
- **Delete** — asks to confirm, then returns to the list. It can't be undone.
- No two scenarios share a fictional person or SSN.

## Scenario tabs

Opening a scenario shows these tabs, in this order.

| Tab | What it shows |
| --- | --- |
| **Documents** | Every document as a watermarked page preview. Admins also get Download PDF / Download packet. |
| **Household & income** | The taxpayer, dependents and income sources. |
| **Preparer tasks** | A checklist for preparing the return; the count shows tasks left. Ticked tasks are remembered in that browser. |
| **Due-diligence traps** | Only when the scenario has them: planted issues a careful preparer should catch. |
| **Answer key** | The correct Form 1040 lines. **Locked for preparers** until every preparer task is ticked (lock icon, a notice with progress, then an "unlocked" notice). Office and admin accounts always see it. |
| **Check my return** · Coming soon | Greyed out; can't be opened yet. |
| **Client interview** · Coming soon | Greyed out; can't be opened yet. |

**Task progress is per browser.** A preparer who switches computer or browser, or clears site data, starts the checklist again (and the answer key locks again until it's done).

## Scenario assistant (AI)

On **New scenario**, office and admin accounts can describe a client in chat or by voice; the assistant fills the form and generates when the interview is complete. The AI never sets any number in documents or the answer key.

- Up to **120 messages** per conversation and 4,000 characters per message.
- Messages that look like a real SSN or EIN are refused: use made-up details only.
- Heavy use is rate-limited for a few minutes.

## PDF downloads

Only the **admin** can download documents (one document, or the whole packet with a cover sheet). Office accounts and preparers view documents in the browser only; the server refuses downloads for them. Every PDF carries the training watermark.

## Team page and the preparer link

For office accounts (header → **Team**). An office gives all its preparers one link and one password.

1. Type a password (at least 8 characters) and click **Turn on link**.
2. Click **Copy link** and send preparers the link and the password.

- **Change password** — preparers already signed in stay signed in; new sign-ins need the new password.
- **Turn off link** — signs every preparer out; set a password again to turn it back on.
- Older individual preparer logins (if any) are listed with **Remove access**.
- Preparers see the office's scenarios and the built-in ones and can't create, save, delete or download.

## Scan & organize (training documents)

Practises the intake step: scan or simulate-scan a scenario's documents, let the reader identify and extract each one, fix what it got wrong, then compare with the answer key.

- It reads **only documents generated by TaxPractice** (stamped TRAINING SAMPLE — NOT FOR FILING). Anything else is refused and nothing from it is kept.
- Everything runs in the user's browser; nothing is uploaded or stored.
- Office and admin accounts also see a second tab here, **Check a real return**, which opens the Return checker. Preparers don't see it.

## Return checker (real returns)

Office and admin accounts only (header → **Return checker**, or Scan & organize → **Check a real return**). It checks a **real, already-prepared 2025 Form 1040** against the client's W-2s and 1099s and against its own arithmetic.

**Private by design.** Everything is read and checked inside the user's browser tab. Nothing is uploaded, saved, logged or sent to AI, and it's gone when the tab closes or the user clicks **Clear**.

### How to use it

1. **Read the 1040 (optional):** pick the PDF saved from the tax software, a scanned PDF, or photos of pages 1 and 2 (upright, page filling the photo). Or type the lines by hand.
2. **Confirm what was read:** each value sits next to an image of its box. Correct misreadings; leave real mistakes on the return as they are. Values marked **unsure**, and every scanned SSN, are confirmed one by one; the rest with one button. Then **Use these values**.
3. **Source documents:** **Read W-2s and 1099s from files** (official IRS layouts of W-2, 1099-INT, 1099-DIV, 1099-NEC, 1099-R; several per page is fine; repeat copies are left out), confirm, **Add these documents**. Type anything else (SSA-1099, payroll-company or brokerage layouts).
4. Set the filing status and boxes (65+, blind, itemizes, Schedule D…) and click **Run checks**.

### What the results mean

- **Boxes filled in wrongly** — format problems: numbers in a name or city, an SSN with letters or the wrong number of digits, an impossible SSN/ITIN, the same SSN twice, a bad state code or ZIP, text or a negative in an amount box, spouse boxes that don't fit the filing status, a half-filled dependent. SSNs are shown masked.
- **Line checks** — **✓ Agrees**, **✗ Differs** (with the expected amount and the rule), or **? Not checked** (with the reason). Differences of $1 or less count as rounding.
- It checks: lines from the documents (1a, 2a, 2b, 3a, 3b, 4b, 5b, 6a, 7a, 25a, 25b, 1099-NEC vs Schedule C), the 1040's arithmetic, the standard deduction and the tax on line 16.
- Not checked yet: 6b, 13a, 13b, 19, 27a, 28 (shown as "not checked" when filled in).

**It never says a return is correct.** It is a review aid. Lines it can't verify are always marked "not checked", never "agrees".

## Admin page

Admin only (header → **Admin**).

- **Import offices** — paste a list (office name, email, optional phone, e.g. from a spreadsheet). A preview marks rows with no email, repeated emails and the admin's own login before anything is created. Option to give each office its own generated password (shown once).
- **Offices** — add an office; delete an office (also deletes its scenarios and removes its people's access).
- **Logins** — add a login (email, password, role, office); change role or office; **Reset password**; edit **Phone**; **Remove access** (removes access to this app only — the login itself stays, because some logins are shared with Referral Circle).
- Each office's shared preparer login appears as **Preparer link (shared)**.
- An email that already has a login (e.g. from Referral Circle) is given access with its **existing** password; the password typed in Admin doesn't apply to it.

## Troubleshooting

Grouped by what the user sees. Quoted text is the exact on-screen message.

**"Invalid login credentials" on Sign in**
- Cause: Wrong email or password, or the login existed before (Referral Circle) and keeps that app's password, or it signs in with Google only.
- Fix: Check the email for typos and extra spaces. Ask them to try their Referral Circle password if they have one. Otherwise escalate to the administrator to **Reset password**. Never ask for their current password.

**"This login has no access to the training site. Ask your administrator to add you to an office."**
- Cause: The email has a login (often from Referral Circle) but no access to TaxPractice, or access was removed.
- Fix: Escalate to the administrator to add the login to the right office (Admin → Add login or Import offices).

**Preparer link: "Wrong password, or this office's link is turned off."**
- Cause: Old password (the office changed it) or the office turned the link off.
- Fix: The preparer asks their office for the current password. The office can check or reset it on the Team page.

**Preparer link: "Link not recognized"**
- Cause: The link was cut off when copied.
- Fix: Ask the office to send the link again using **Copy link**.

**"Application error: a client-side exception has occurred", or the page looks out of date**
- Cause: Usually a tab left open while a new version went live.
- Fix: Reload fully: **Ctrl+Shift+R** (Windows) or **Cmd+Shift+R** (Mac), or close the tab and open the site again. If it persists, collect a screenshot, the page address and the first red line from the browser console (F12 → Console) and escalate.

**"The answer key is locked"**
- Cause: By design for preparers: every preparer task must be ticked first. Progress is stored per browser.
- Fix: Open **Preparer tasks** and tick every task. If they changed computer or browser, they need to tick them again there.

**A scenario disappeared after a reload**
- Cause: An office account generated it but didn't click **Save scenario**.
- Fix: It can't be recovered; generate it again (the same template and seed recreate it exactly) and click Save.

**"… wasn't saved and will be gone after a reload" / "wasn't added to the built-in scenarios"**
- Cause: The save didn't reach the server (connection, or the account's access changed).
- Fix: Click **Save scenario** / **Save as built-in** again. If it keeps failing, escalate with the full message.

**"Still loading your account. Try again in a moment." or the button says "Loading your account…"**
- Cause: The page opened a second ago and hasn't finished checking who is signed in.
- Fix: Wait a moment; the button enables itself.

**"I can't find New scenario / Delete / Download / Team / Return checker"**
- Cause: The account type doesn't include it (see Account types). Downloads are admin-only; preparers can't create or delete.
- Fix: Explain the role's access. Role changes are made by the administrator.

**"Your login isn't linked to an office yet"**
- Fix: Escalate to the administrator to place the login in an office.

**Scan & organize: "This page wasn't processed (no TRAINING SAMPLE marking)"**
- Cause: By design: the training scanner reads only documents generated by TaxPractice.
- Fix: Use a scenario's own documents. To check a real return, an office or admin uses the Return checker.

**Return checker: "This doesn't look like a 2025 Form 1040."**
- Cause: Wrong form or year, a tilted or cropped photo, or a very low-resolution scan.
- Fix: Use the PDF saved from the tax software, or upright scans of pages 1 and 2 at 200–300 DPI with the page filling the image. Or type the lines by hand.

**Return checker: "No official-layout W-2 or 1099 was found."**
- Cause: The document isn't in the official IRS layout (payroll-company W-2, brokerage composite 1099) or is an SSA-1099.
- Fix: Type those amounts with **+ Add W-2** / **+ Add 1099-…**.

**Return checker: many values marked "unsure"**
- Cause: Blurry, dark or tilted pages. Scanned SSNs are always marked unsure because the form's printed dividers can cut through digits.
- Fix: Compare each with its image and correct it, or rescan flat and upright at 300 DPI.

**"These amounts aren't numbers: …"**
- Fix: If the return really shows that, it's also listed under "boxes filled in wrongly". Type the intended number to run the math checks.

**"A conversation needs 1–120 messages."**
- Fix: Start a new conversation with the assistant (Start over).

**"Too many requests. Wait a few minutes and try again."**
- Fix: Wait about 10 minutes before using the assistant again.

**"The AI couldn't answer just now." / "The AI assistant isn't configured"**
- Fix: Try again in a moment, or fill the form by hand (templates work without AI). If it persists, escalate.

**"That message contains what looks like a real SSN or EIN"**
- Fix: By design. Remove real identifiers; describe the client with made-up details only.

## Ready-to-send replies

**Can't sign in:** Thanks for reaching out. Please check that you're using the exact email your office login was created with, and that there are no spaces before or after it. If it still says "Invalid login credentials", reply to this ticket and we'll have the administrator reset your password and send you a new one. Please don't send us your password.

**Answer key locked (preparer):** The answer key opens once every item on the Preparer tasks tab is ticked. Your progress is saved in the browser you used, so if you switched computer or browser you'll need to tick the tasks again there.

**Page error / old version:** A new version of the site went live while your page was open. Please press Ctrl+Shift+R (Cmd+Shift+R on a Mac) to reload it fully, or close the tab and open the site again.

**Downloads (office):** Documents can be viewed in the browser on the Documents tab. Downloading them as PDFs is limited to the administrator.

**Is my data private? (Return checker):** The Return checker reads and checks everything inside your own browser tab. Nothing is uploaded, saved, logged or sent to AI, and it's cleared when you close the tab or click Clear.

## Privacy and safety answers

- **Training scenarios contain no real people.** Names, employers and identifiers are fictional; SSNs are deliberately in ranges that can't belong to anyone. Every page says TRAINING SAMPLE — NOT FOR FILING.
- **Training documents can't be filed.** They are watermarked and refused by the app's own scanner if they aren't TaxPractice documents.
- **The Return checker keeps real data in the browser.** No upload, storage, logging or AI. Offices using it remain responsible for their own taxpayer-data obligations.
- **Offices are separated.** An office can't see or delete another office's scenarios; this is enforced by the database, not just the screens.
- **AI never sets numbers.** All amounts and answer keys come from the tax calculator.

## Escalation and ticket intake

### Collect in every ticket

- The login email and office name (never the password).
- Account type (admin, office, preparer link).
- The page address and what they clicked, with the time it happened.
- The exact message on screen, ideally a screenshot. For page errors, the first red line from F12 → Console.
- Browser and device. For checker reading problems: PDF from software, scan or photo.

**Never collect** passwords, real taxpayer documents, real SSNs or client information. If a user attaches a real tax document to a ticket, delete the attachment and remind them that support never needs client documents.

### Escalate to the administrator

- Password resets, new logins, role or office changes, removing access, offices to add or delete.
- A scenario that won't save after retrying, or a repeating page error after a full reload.
- Anything suggesting someone sees another office's scenarios (treat as urgent).
- Return checker results a user believes are wrong after confirming every value (include the line, the rule shown, expected and found — no client documents).

### Not support's to change

- Who can download, create or delete (set by account type).
- The answer-key lock for preparers and the "Coming soon" tabs.
- The training scanner refusing non-TaxPractice documents.

## Glossary

| Term | Meaning |
| --- | --- |
| **Scenario** | One fictional client with documents, tasks and an answer key. |
| **Built-in scenario** | Made by the admin (or bundled); every office and preparer sees it. |
| **Office scenario** | Made and saved by an office; only that office sees it. |
| **Seed** | The code that, with the same setup, recreates a scenario exactly. |
| **Answer key** | The correct Form 1040 lines for a scenario, from the tax calculator. |
| **Due-diligence trap** | A planted issue in a scenario that a careful preparer should catch. |
| **Preparer link** | An office's single sign-in link plus password for all its preparers. |
| **Return checker** | The office/admin tool that checks a real prepared 1040 in the browser. |
| **Unsure** | A value the checker read but isn't confident about; it must be confirmed on its own. |
| **Referral Circle** | The owner's other app; some logins are shared with it. |

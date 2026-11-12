# TradeMate SA

A mobile-friendly business app for South African tradespeople: customers, professional PDF quotations, and job tracking. Built as an installable web app (PWA) for Android.

**Stack:** React + Vite (JavaScript), Supabase (login + database), pdf-lib (PDF quotations), Vercel (hosting). Currency: South African rand (ZAR).

## Run it on your computer

1. Open Command Prompt (Windows key + R, type `cmd`, press Enter).
2. Go to the project folder: `cd %USERPROFILE%\Documents\trademate-sa`
3. Install the packages (first time only): `npm install`
4. Create a file called `.env.local` in the project folder containing:

   ```
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
   ```

   Find both in Supabase: Project Settings, then API Keys. Only use the **publishable** key. Never use a secret or service_role key in this app.
5. Start the app: `npm run dev` and open the address it shows (usually http://localhost:5173).
6. Stop it with Ctrl + C.

## Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the app for development |
| `npm run build` | Makes the production version in the `dist` folder |
| `npm run preview` | Runs the production version locally (the service worker only works here and online) |
| `npm run lint` | Checks the code for mistakes |
| `node src/lib/money.test.mjs` | Tests the money and VAT calculations |

## Database

The whole database (tables, security rules, quote numbering) is in `supabase/migrations/001_initial_schema.sql`. To rebuild it: open the Supabase SQL Editor and run that file. `supabase/reset.sql` deletes everything first (careful: it erases all data).

Security: every table uses Row Level Security, so each business only ever sees its own customers, quotations and jobs. Test this again after any database change using the temporary page at `/security-test` with two accounts. Remove that page before launch.

Money is stored as whole cents. Prices are entered excluding VAT, the discount comes off before VAT, and VAT is optional per quotation (off by default).

## Folder guide

- `src/pages` - the screens (Dashboard, Customers, Quotations, QuoteEditor, Jobs, JobDetail, Settings, Login)
- `src/lib` - Supabase connection, money maths, PDF drawing
- `src/components` - navigation and shared pieces
- `public` - icons, PWA manifest, service worker (`sw.js`), offline page

## Deploying (Vercel)

1. Push the code to GitHub (the `.env.local` file must never be uploaded; it is already ignored).
2. In Vercel, import the GitHub repository. Framework: Vite.
3. Add the two environment variables above in Vercel before deploying.
4. After deploying, add the live address to Supabase under Authentication, URL Configuration.
5. Every push to GitHub redeploys automatically.

## Keeping it safe

- Never put passwords, secret keys or `.env` files on GitHub.
- The service worker only stores the app's own files. It never stores customer data.
- If you change `public/sw.js`, change the `VERSION` name at the top so phones pick up the update.

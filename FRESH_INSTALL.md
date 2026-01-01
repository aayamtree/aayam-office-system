# FRESH INSTALLATION GUIDE (2025)

## 1. Supabase Setup (Database)
1. Go to [Supabase](https://supabase.com) and create a **New Project**.
2. Go to **Settings -> API**.
   - Copy **Project URL**.
   - Copy **anon / public** Key.
3. Go to **SQL Editor**.
4. Open the file `supabase/COMPLETE_FRESH_SETUP.sql` from this codebase.
5. Paste the content into the SQL Editor and click **Run**.
   - *Result: "Success" message at the bottom.*
6. Go to **Authentication -> Providers**. Ensure "Email" is enabled.
7. Go to **Authentication -> URL Configuration**.
   - Add your localhost: `http://localhost:3000`
   - (Later) Add your Vercel URL.

## 2. Local Environment Setup
1. Rename `.env.example` to `.env.local` (if not done).
2. Paste your **Supabase URL** and **Anon Key** into `.env.local`.
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
3. Run the app locally to test:
   ```bash
   npm run dev
   ```
4. Configure your Admin User:
   - Go to http://localhost:3000/login
   - Use the "Demo Login" OR Sign Up a new user.
   - If you Sign Up, go to Supabase -> Table Editor -> `profiles`. Change your `role` from 'staff' to 'admin' manually.

## 3. Deployment (Vercel)
1. In terminal, run:
   ```bash
   vercel login
   ```
2. Run deployment:
   ```bash
   vercel deploy --prod
   ```
   - Follow prompts (Say 'yes' to link to existing project? No, create NEW since you deleted old).
   - **IMPORTANT**: It will ask to set Environment Variables.
   - You MUST add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` when prompted (or in Vercel Dashboard Settings later).

## 4. Final Connection
1. Copy the **Production URL** (e.g., `https://aayam-office-new.vercel.app`) from Vercel.
2. Go back to **Supabase -> Authentication -> URL Configuration**.
3. Add this URL to "Redirect URLs".

**Done! The system is live with a perfectly matched database.**

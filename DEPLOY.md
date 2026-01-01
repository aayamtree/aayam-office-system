# Deployment Guide: Aayam Office System

This guide will help you deploy the **Aayam Office System** application to the web using **Vercel** and **Supabase**.

## Prerequisites

-   A [GitHub](https://github.com/) account.
-   A [Vercel](https://vercel.com/) account (you can sign up with GitHub).
-   Your **Supabase** project URL and Anon Key.

---

## Step 1: Push to GitHub

Since I have already initialized the local Git repository for you, you just need to create a remote repository on GitHub and push the code.

1.  Log in to **GitHub** and create a **New Repository**.
    *   **Repository Name**: `aayam-office-system` (or any name you prefer).
    *   **Public/Private**: Private is recommended for internal tools.
    *   **Initialize with README**: No (uncheck this).
    *   **Add .gitignore**: None.
    *   **Add license**: None.

2.  Copy the commands under "**…or push an existing repository from the command line**".

3.  Run those commands in your terminal here (replace `YOUR_USERNAME` with your actual GitHub username):

    ```bash
    git remote add origin https://github.com/YOUR_USERNAME/aayam-office-system.git
    git branch -M main
    git push -u origin main
    ```

---

## Step 2: Deploy to Vercel

1.  Log in to your **Vercel Dashboard**.
2.  Click **"Add New..."** -> **"Project"**.
3.  Under **"Import Git Repository"**, you should see your new `aayam-office-system` repo. Click **"Import"**.
4.  In the **Configure Project** screen:
    *   **Framework Preset**: Next.js (should be auto-detected).
    *   **Root Directory**: `./` (default).

5.  **Environment Variables**:
    *   Expand the "Environment Variables" section.
    *   Add the following variables (copy values from your local `.env.local` or Supabase dashboard):
        *   `NEXT_PUBLIC_SUPABASE_URL`: `https://YOUR_PROJECT_ID.supabase.co`
        *   `NEXT_PUBLIC_SUPABASE_ANON_KEY`: `YOUR_LONG_ANON_KEY_STRING`

6.  Click **"Deploy"**.

---

## Step 3: Verify Deployment

1.  Wait for the build to complete (usually 1-2 minutes).
2.  Once finished, you will get a live URL (e.g., `https://aayam-office-system.vercel.app`).
3.  Open the URL and log in with your credentials.

---

## Step 4: Supabase Production Settings

*   **Authentication**:
    *   Go to your Supabase Dashboard -> **Authentication** -> **URL Configuration**.
    *   Add your new Vercel URL (e.g., `https://aayam-office-system.vercel.app`) to the **Site URL** and **Redirect URLs**. This is crucial for login redirections.

*   **Database**:
    *   Ensure your Row Level Security (RLS) policies are set up if you enable public sign-ups (though currently, it looks like an admin-focused tool).

---

## Troubleshooting

*   **Build Errors**: Check the "Logs" tab in Vercel.
*   **Login Issues**: Verify the Supabase URL and Anon Key in Vercel Settings -> Environment Variables.

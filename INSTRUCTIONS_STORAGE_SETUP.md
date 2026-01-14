# How to Configure Supabase Storage Manually

Since the SQL script failed due to permission restrictions (a common safeguard in Supabase), please follow these simple steps in your **Supabase Dashboard**:

### 1. Create the Bucket
1.  Click on the **Storage** icon in the left sidebar (looks like a hard drive/box).
2.  Click the **"New Bucket"** button.
3.  **Name**: Enter `files`.
4.  **Public Bucket**: Toggle this **ON** (make it green/checked). This allows anyone to view the images once uploaded.
5.  Click **"Create Bucket"**.

### 2. Set Upload Permissions (Policies)
1.  Click on the newly created `files` bucket.
2.  Click the **"Configuration"** or **"Policies"** tab (usually near the top right or under a settings gear).
3.  Look for **"Row Level Security (RLS)"** - it should be enabled.
4.  Click **"New Policy"** (and choose "For full customization" or "Get started quickly").
5.  **Create "Read" Policy**:
    *   Name: `Public Read`
    *   Allowed Operations: `SELECT`
    *   Target roles: `anon`, `authenticated` (or just check "All").
    *   Click **Review** -> **Save**.
5.  **Create "Upload" Policy**:
    *   Name: `Staff Upload`
    *   Allowed Operations: `INSERT`
    *   Target roles: `authenticated` (Staff members).
    *   Click **Review** -> **Save**.

That's it! Your file uploads will now work.

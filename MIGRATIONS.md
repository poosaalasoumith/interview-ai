# InterviewAI Supabase Migrations & Developer Workflow Guide

This guide describes how to manage the **InterviewAI** database schema using the automated, version-controlled **Supabase CLI migration system**. 

By adopting this workflow, the project completely eliminates manual copy-pasting of SQL scripts into the remote Supabase Editor, replacing it with professional, trackable, and safe database evolutions.

---

## 1. Migration System Architecture

Instead of a single database monolith, the database lifecycle is version-controlled inside the project repository under:
`supabase/migrations/<timestamp>_schema_initialization.sql`

Whenever the schema changes, developers generate a new version-controlled migration file and apply it. Supabase keeps track of applied migrations in a dedicated system table `supabase_migrations.schema_migrations`.

---

## 2. Developer NPM Commands

We have integrated standard commands directly into the `package.json` scripts:

| Command | Action | Description |
|---|---|---|
| `npm run db:init` | `supabase init` | Re-initializes or checks the local Supabase folder setup. |
| `npm run db:new <name>` | `supabase migration new <name>` | Generates a new, timestamped, blank migration SQL file. |
| `npm run db:status` | `supabase db status` | Checks the migration state (local vs remote) to see what is pending. |
| `npm run db:push` | `supabase db push` | Safely applies all pending local migrations to the remote database. |

*Note: You can prepend `npx` if you don't have the CLI globally installed: e.g. `npx supabase db push`.*

---

## 3. Local Development Setup

To run a fully isolated local Supabase PostgreSQL environment with Docker:

1. **Prerequisites**: Make sure [Docker Desktop](https://www.docker.com/products/docker-desktop/) is running.
2. **Start Local Database**:
   ```bash
   npx supabase start
   ```
   This will spin up a local postgres db, auth service, storage, and studio locally at `http://localhost:54323`.
3. **Reset and Apply Migrations Locally**:
   ```bash
   npx supabase db reset
   ```
   This recreates the local database and runs all migrations inside `supabase/migrations/` from scratch.
4. **Stop Local Environment**:
   ```bash
   npx supabase stop
   ```

---

## 4. Connecting and Syncing with Supabase Cloud

To connect your local workspace to your live Supabase cloud project:

1. **Retrieve the Project Reference ID**:
   The reference ID for this project is `trenkruwscbjcpzuxuon` (found in the project URL `https://trenkruwscbjcpzuxuon.supabase.co`).
2. **Link the Project**:
   ```bash
   npx supabase link --project-ref trenkruwscbjcpzuxuon
   ```
   *Note: This will prompt you for the Database Password of your Supabase Cloud project.*
3. **Check Synchronization Status**:
   ```bash
   npm run db:status
   ```
   This will display which migrations are already tracked and applied, and which ones are only local (pending).
4. **Deploy Pending Migrations Safely**:
   ```bash
   npm run db:push
   ```
   This pushes all pending migration files to the cloud database and applies them in order.

---

## 5. Non-Destructive baseline Strategy

> [!IMPORTANT]
> **Why are our migrations non-destructive?**
> The baseline migration file `20260521035839_schema_initialization.sql` uses **idempotent SQL operations**:
> - `CREATE TABLE IF NOT EXISTS` for all tables.
> - Checking type definitions before creating enums.
> - `CREATE INDEX IF NOT EXISTS` for indexes.
> - `DROP POLICY IF EXISTS` prior to recreating RLS policies.
> - `DROP TRIGGER IF EXISTS` prior to recreating database-level hooks.
>
> **What this means**: Running `npx supabase db push` is **completely safe** to execute against the existing cloud database. It will register the migration file in the tracking table without wiping, modifying, or resetting any of your existing candidate data, scheduled interviews, or AI feedback records.

---

## 6. How to Evolve the Schema (Incremental Migrations)

When you need to make a database change (e.g., adding a new field or a new table):

1. **Generate a New Migration File**:
   ```bash
   npm run db:new add_is_active_to_users
   ```
   This creates a file like: `supabase/migrations/20260521123456_add_is_active_to_users.sql`.
2. **Write the Incremental SQL**:
   Edit the file to include *only* the change:
   ```sql
   ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
   ```
3. **Verify Locally**:
   Run `npx supabase db reset` to ensure the new migration applies successfully from a clean slate.
4. **Push to Production / Cloud**:
   ```bash
   npm run db:push
   ```

---

## 7. CI/CD & Vercel deployment Integrations

To automate database migrations inside a Git-based deployment pipeline (like GitHub Actions + Vercel):

### GitHub Actions Workflow Example
Add this job step prior to building and deploying to Vercel:

```yaml
name: Deploy Database Migrations
on:
  push:
    branches:
      - main

jobs:
  deploy-database:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v3

      - name: Install Node & Dependencies
        uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Run Supabase Migrations
        run: npx supabase db push --db-url ${{ secrets.SUPABASE_DB_CONNECTION_STRING }}
```

**Required Secret**:
- `SUPABASE_DB_CONNECTION_STRING`: The pooler/direct connection string to your database (found in Supabase Dashboard -> Database -> Connection Strings). Example: `postgresql://postgres.[ref_id]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`

---

## 8. Rollback Strategies

If a migration fails or you need to undo a change:

1. **Local Rollback**:
   Delete the faulty migration file from `supabase/migrations/` and run `npx supabase db reset` to rebuild the database schema cleanly.
2. **Remote Rollback**:
   - Write a new "fix-forward" migration file (e.g., `npm run db:new revert_faulty_migration`) that executes the inverse SQL statements (e.g., `ALTER TABLE public.users DROP COLUMN IF EXISTS is_active;`).
   - Run `npm run db:push` to apply the fix-forward migration.
   - *This is the safest and recommended approach for production environments.*

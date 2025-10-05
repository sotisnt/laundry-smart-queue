# Secure `machine_usage` Table with Supabase Auth & RLS

## 1. Add Supabase Auth to Your Project

Follow [Supabase Quickstart](https://supabase.com/docs/guides/getting-started/quickstarts) to enable authentication and initialize the client in your TypeScript app.

## 2. Update the Database Schema

Add a `user_id` column (UUID) to the `machine_usage` table.

```sql
ALTER TABLE machine_usage
ADD COLUMN user_id uuid REFERENCES auth.users(id);

-- (Optional) Backfill user_id for existing rows if you have mapping info
```

## 3. Enable Row-Level Security

```sql
ALTER TABLE machine_usage ENABLE ROW LEVEL SECURITY;
```

## 4. Create RLS Policies

### 4.1. Only Allow Viewing Own Records

```sql
CREATE POLICY "Users can view their own usage records"
ON machine_usage FOR SELECT
USING (
  auth.role() = 'authenticated'
  AND user_id = auth.uid()
  OR auth.role() = 'service_role'
  OR auth.role() = 'admin'
);
```

### 4.2. Only Allow Service Accounts to Write

```sql
-- Block all direct inserts/updates/deletes by normal users
CREATE POLICY "Only service and admin can insert"
ON machine_usage FOR INSERT
USING (auth.role() IN ('service_role', 'admin'));

CREATE POLICY "Only service and admin can update"
ON machine_usage FOR UPDATE
USING (auth.role() IN ('service_role', 'admin'));

CREATE POLICY "Only service and admin can delete"
ON machine_usage FOR DELETE
USING (auth.role() IN ('service_role', 'admin'));
```

## 5. Grant Admin Access

- Assign the `admin` role to your admin users in Supabase Auth.
- Admins will have access to all records.

## 6. Update Your App Logic

- Only allow users to submit usage changes via your backend (service account).
- Pass the `user_id` from the authenticated session; do not let users specify it manually.

## 7. Documentation

Document these changes for future maintainers.

---

**References:**
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Supabase RLS Docs](https://supabase.com/docs/guides/auth/row-level-security)
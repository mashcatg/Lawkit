# Database Migrations Guide

How to safely modify the database schema and structure.

## Overview

**CRITICAL**: All database changes MUST be made through migrations. Never edit the database directly.

Migrations are SQL scripts that modify the database schema in a controlled, versioned way. They ensure:
- Changes are tracked
- Changes can be reviewed before applying
- Changes are reproducible across environments
- The database stays in sync with your code

---

## Using the Lovable Migration Tool

Lovable provides a migration tool that handles all database changes.

### Step 1: Invoke the Tool

When you need to make database changes, call the migration tool with your SQL:

```typescript
// In your Lovable chat, request a migration
"Add a notes column to the conversations table"
```

The AI will call the migration tool with the appropriate SQL.

### Step 2: Review the Migration

The tool will show you:
- The SQL that will be executed
- Any potential security warnings
- Impact on existing data

**Example output**:
```
Migration Preview:
------------------
ALTER TABLE conversations 
ADD COLUMN notes TEXT;

⚠️ This will add a nullable column to 1,234 existing rows
✓ No security issues detected
```

### Step 3: Approve or Reject

- ✅ **Approve**: The migration runs and updates your database
- ❌ **Reject**: No changes are made

### Step 4: Verify Changes

After approval, the tool:
- Executes the SQL
- Updates the database schema
- Regenerates TypeScript types
- Displays any errors or warnings

---

## Common Migration Patterns

### Adding a New Table

```sql
-- Create a new table with RLS enabled
CREATE TABLE public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "Users can view their own notes"
  ON public.notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own notes"
  ON public.notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes"
  ON public.notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes"
  ON public.notes FOR DELETE
  USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
```

---

### Adding a Column

```sql
-- Add a nullable column (safe for existing data)
ALTER TABLE conversations
ADD COLUMN tags TEXT[];

-- Add a non-nullable column with default
ALTER TABLE conversations
ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT false;

-- Add a column with a foreign key
ALTER TABLE messages
ADD COLUMN parent_message_id UUID REFERENCES messages(id) ON DELETE SET NULL;
```

---

### Modifying a Column

```sql
-- Change column type
ALTER TABLE conversations
ALTER COLUMN title TYPE VARCHAR(500);

-- Add NOT NULL constraint (ensure no nulls exist first!)
UPDATE conversations SET title = 'Untitled' WHERE title IS NULL;
ALTER TABLE conversations
ALTER COLUMN title SET NOT NULL;

-- Add a default value
ALTER TABLE conversations
ALTER COLUMN privacy SET DEFAULT 'private';

-- Remove a default value
ALTER TABLE conversations
ALTER COLUMN privacy DROP DEFAULT;
```

---

### Removing a Column

```sql
-- Drop a column (DESTRUCTIVE - data will be lost)
ALTER TABLE conversations
DROP COLUMN notes;
```

⚠️ **Warning**: Dropping columns deletes data permanently. Consider:
1. Backing up the data first
2. Marking the column as deprecated instead
3. Ensuring no code references the column

---

### Adding Indexes

```sql
-- Add index for faster queries
CREATE INDEX idx_messages_conversation_id 
  ON messages(conversation_id);

-- Add composite index
CREATE INDEX idx_conversations_user_updated 
  ON conversations(user_id, updated_at DESC);

-- Add unique index
CREATE UNIQUE INDEX idx_profiles_email 
  ON profiles(email);

-- Add partial index
CREATE INDEX idx_public_conversations 
  ON conversations(id) 
  WHERE privacy = 'public';
```

---

### Modifying RLS Policies

```sql
-- Drop existing policy
DROP POLICY "Users can view their own conversations" ON conversations;

-- Create updated policy
CREATE POLICY "Users can view accessible conversations"
  ON conversations FOR SELECT
  USING (
    auth.uid() = user_id OR
    privacy = 'public' OR
    (privacy = 'shared' AND shared_with ? auth.email())
  );
```

---

### Creating Functions

```sql
-- Create a function to calculate statistics
CREATE OR REPLACE FUNCTION get_user_conversation_count(user_uuid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  conv_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO conv_count
  FROM conversations
  WHERE user_id = user_uuid;
  
  RETURN conv_count;
END;
$$;
```

---

### Adding Triggers

```sql
-- Create trigger to log changes
CREATE TRIGGER log_conversation_changes
  AFTER UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION log_change();

-- Create trigger function
CREATE OR REPLACE FUNCTION log_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO change_log (table_name, record_id, changed_at)
  VALUES (TG_TABLE_NAME, NEW.id, now());
  RETURN NEW;
END;
$$;
```

---

## Best Practices

### 1. Always Use Transactions
Migrations are automatically wrapped in transactions, but be aware:
```sql
BEGIN;
  -- Multiple operations
  ALTER TABLE ...;
  CREATE INDEX ...;
COMMIT;
```

### 2. Make Migrations Reversible
Consider how to undo your changes:
```sql
-- Migration up
ALTER TABLE conversations ADD COLUMN tags TEXT[];

-- Migration down (if needed)
-- ALTER TABLE conversations DROP COLUMN tags;
```

### 3. Test with Production-Like Data
Before running migrations:
- Test on a copy of production data
- Check query performance with real data volumes
- Verify RLS policies work correctly

### 4. Handle Existing Data
When adding constraints:
```sql
-- First, fix existing data
UPDATE conversations 
SET privacy = 'private' 
WHERE privacy IS NULL;

-- Then add constraint
ALTER TABLE conversations
ALTER COLUMN privacy SET NOT NULL;
```

### 5. Use Appropriate Column Defaults
```sql
-- Good: Safe default for new rows
ALTER TABLE conversations
ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0;

-- Bad: Expensive default calculation
-- ALTER TABLE conversations
-- ADD COLUMN computed_value INTEGER DEFAULT (expensive_function());
```

---

## Migration Checklist

Before requesting a migration, ensure:

- [ ] SQL is correct and tested
- [ ] RLS policies are included for new tables
- [ ] Indexes are added for foreign keys
- [ ] Updated_at triggers are added if needed
- [ ] Existing data is handled appropriately
- [ ] No breaking changes to existing code
- [ ] Column types are appropriate
- [ ] Constraints are reasonable
- [ ] Foreign keys have ON DELETE clauses
- [ ] Functions have SECURITY DEFINER when needed

---

## Common Errors and Solutions

### Error: "column does not exist"
**Cause**: Code references a column before migration runs  
**Solution**: Ensure migration runs before deploying code changes

### Error: "violates foreign key constraint"
**Cause**: Trying to add FK when orphaned records exist  
**Solution**: Clean up orphaned data first
```sql
DELETE FROM messages 
WHERE conversation_id NOT IN (SELECT id FROM conversations);
```

### Error: "column contains null values"
**Cause**: Adding NOT NULL to column with existing nulls  
**Solution**: Fill nulls first
```sql
UPDATE table SET column = 'default' WHERE column IS NULL;
```

### Error: "permission denied for table"
**Cause**: RLS policy too restrictive  
**Solution**: Review and update policies
```sql
-- Check current policies
SELECT * FROM pg_policies WHERE tablename = 'your_table';
```

---

## Advanced Patterns

### Zero-Downtime Column Addition

```sql
-- Step 1: Add nullable column
ALTER TABLE conversations ADD COLUMN new_field TEXT;

-- Step 2: Backfill data (do this gradually for large tables)
UPDATE conversations SET new_field = 'default' WHERE new_field IS NULL;

-- Step 3: Make NOT NULL
ALTER TABLE conversations ALTER COLUMN new_field SET NOT NULL;
```

### Safe Column Rename

```sql
-- Instead of renaming, add new column and migrate data
ALTER TABLE conversations ADD COLUMN new_name TEXT;
UPDATE conversations SET new_name = old_name;
-- Update code to use new_name
-- Later, drop old_name
```

### Data Migration with Function

```sql
-- Create migration function
CREATE OR REPLACE FUNCTION migrate_data()
RETURNS void AS $$
BEGIN
  -- Complex data transformation
  INSERT INTO new_table (...)
  SELECT ... FROM old_table ...;
END;
$$ LANGUAGE plpgsql;

-- Run migration
SELECT migrate_data();

-- Clean up
DROP FUNCTION migrate_data();
```

---

## Important Reminders

1. **Never modify these files**:
   - `src/integrations/supabase/types.ts` (auto-generated)
   - `src/integrations/supabase/client.ts` (auto-configured)
   - `.env` (auto-managed)

2. **Always use migrations** for:
   - Schema changes
   - New tables
   - RLS policies
   - Functions and triggers
   - Indexes

3. **Test migrations**:
   - On local/staging first
   - With real data volumes
   - With RLS policies active
   - With your application code

4. **Backup before major changes**:
   - Export critical data
   - Document the change
   - Have a rollback plan

5. **Consider impact**:
   - Will this break existing code?
   - Will this affect performance?
   - Will this change data access?
   - Will this require code updates?

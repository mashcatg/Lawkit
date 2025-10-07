# Database Functions and Triggers

Documentation of all database functions and triggers.

## Overview

The database uses PostgreSQL functions and triggers to automate common tasks like:
- Updating timestamps
- Creating user profiles on signup
- Maintaining data integrity

---

## Functions

### update_updated_at_column()

**Purpose**: Automatically updates the `updated_at` column when a row is modified.

**Type**: Trigger Function  
**Language**: PL/pgSQL  
**Security**: DEFINER  
**Search Path**: public

**Source Code**:
```sql
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
```

**Usage**: Automatically attached to tables with `updated_at` columns via triggers.

**Example**:
```sql
-- When you update a conversation:
UPDATE conversations 
SET title = 'New Title' 
WHERE id = 'some-uuid';
-- updated_at is automatically set to current timestamp
```

---

### handle_new_user()

**Purpose**: Creates a profile record when a new user signs up.

**Type**: Trigger Function  
**Language**: PL/pgSQL  
**Security**: DEFINER  
**Search Path**: public

**Source Code**:
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    new.email
  );
  RETURN new;
END;
$function$
```

**Triggered By**: INSERT on `auth.users` table

**Behavior**:
1. Extracts user ID, full name (from metadata), and email from new auth user
2. Creates corresponding profile record in `public.profiles`
3. Uses COALESCE to handle missing full_name gracefully

**Example**:
```typescript
// When a user signs up:
await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password123',
  options: {
    data: {
      full_name: 'John Doe'
    }
  }
});
// Automatically creates profile with id, 'John Doe', and 'user@example.com'
```

---

## Triggers

### Trigger: update_conversations_updated_at

**Table**: conversations  
**Event**: BEFORE UPDATE  
**For Each**: ROW  
**Function**: update_updated_at_column()

**Purpose**: Updates `updated_at` timestamp whenever a conversation is modified.

**Creation SQL**:
```sql
CREATE TRIGGER update_conversations_updated_at
BEFORE UPDATE ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
```

**Example**:
```typescript
// When you update conversation privacy:
await supabase
  .from('conversations')
  .update({ privacy: 'public' })
  .eq('id', conversationId);
// updated_at automatically set to now()
```

---

### Trigger: update_profiles_updated_at

**Table**: profiles  
**Event**: BEFORE UPDATE  
**For Each**: ROW  
**Function**: update_updated_at_column()

**Purpose**: Updates `updated_at` timestamp whenever a profile is modified.

**Creation SQL**:
```sql
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
```

**Example**:
```typescript
// When user updates their profile:
await supabase
  .from('profiles')
  .update({ full_name: 'Jane Smith' })
  .eq('id', userId);
// updated_at automatically set to now()
```

---

### Trigger: on_auth_user_created

**Table**: auth.users  
**Event**: AFTER INSERT  
**For Each**: ROW  
**Function**: handle_new_user()

**Purpose**: Automatically creates a profile when a user signs up.

**Creation SQL**:
```sql
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();
```

**Example**:
```typescript
// User signs up through Supabase Auth:
const { data, error } = await supabase.auth.signUp({
  email: 'newuser@example.com',
  password: 'securepassword',
  options: {
    data: { full_name: 'New User' }
  }
});
// Profile automatically created with matching ID
```

---

## Creating Custom Functions

When you need to add database logic, create functions using migrations:

### Example: Calculate Message Count

```sql
CREATE OR REPLACE FUNCTION get_conversation_message_count(conversation_uuid uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  msg_count integer;
BEGIN
  SELECT COUNT(*)
  INTO msg_count
  FROM messages
  WHERE conversation_id = conversation_uuid;
  
  RETURN msg_count;
END;
$$;
```

**Usage**:
```typescript
const { data, error } = await supabase.rpc('get_conversation_message_count', {
  conversation_uuid: conversationId
});
console.log('Message count:', data);
```

---

## Best Practices

### 1. Use SECURITY DEFINER Carefully
```sql
-- SECURITY DEFINER runs with creator's permissions
-- Only use for trusted, well-tested functions
CREATE FUNCTION sensitive_operation()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs as superuser
SET search_path TO 'public'  -- Prevent injection
AS $$ ... $$;
```

### 2. Set search_path Explicitly
```sql
-- Always set search_path to prevent schema injection
SET search_path TO 'public'
```

### 3. Handle Errors Gracefully
```sql
CREATE FUNCTION safe_insert()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO table VALUES (...);
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Duplicate entry';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Unexpected error: %', SQLERRM;
END;
$$;
```

### 4. Use Appropriate Trigger Timing
```sql
-- BEFORE triggers can modify NEW values
CREATE TRIGGER before_insert
BEFORE INSERT ON table
FOR EACH ROW
EXECUTE FUNCTION modify_values();

-- AFTER triggers cannot modify values but can see final result
CREATE TRIGGER after_insert
AFTER INSERT ON table
FOR EACH ROW
EXECUTE FUNCTION log_insert();
```

### 5. Return Properly in Triggers
```sql
-- FOR EACH ROW triggers must return NEW or OLD
CREATE FUNCTION my_trigger()
RETURNS trigger
AS $$
BEGIN
  -- Do something
  RETURN NEW;  -- CRITICAL: Must return NEW for INSERT/UPDATE
END;
$$;
```

---

## Common Function Patterns

### Aggregate Data
```sql
CREATE FUNCTION get_conversation_stats(conv_id uuid)
RETURNS TABLE(
  message_count bigint,
  file_count bigint,
  last_activity timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT m.id),
    COUNT(DISTINCT cf.id),
    MAX(m.created_at)
  FROM conversations c
  LEFT JOIN messages m ON m.conversation_id = c.id
  LEFT JOIN conversation_files cf ON cf.conversation_id = c.id
  WHERE c.id = conv_id;
END;
$$ LANGUAGE plpgsql;
```

### Conditional Logic
```sql
CREATE FUNCTION can_user_edit_conversation(conv_id uuid, usr_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM conversations
    WHERE id = conv_id
    AND user_id = usr_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Batch Operations
```sql
CREATE FUNCTION archive_old_conversations(days_old integer)
RETURNS integer AS $$
DECLARE
  archived_count integer;
BEGIN
  WITH archived AS (
    UPDATE conversations
    SET privacy = 'archived'
    WHERE updated_at < now() - (days_old || ' days')::interval
    RETURNING *
  )
  SELECT COUNT(*) INTO archived_count FROM archived;
  
  RETURN archived_count;
END;
$$ LANGUAGE plpgsql;
```

---

## Debugging Functions

### View Function Source
```sql
SELECT pg_get_functiondef('public.update_updated_at_column'::regproc);
```

### Test Trigger Functions Directly
```sql
-- Create test data
INSERT INTO conversations (user_id, title) 
VALUES (auth.uid(), 'Test');

-- Update to trigger
UPDATE conversations SET title = 'Updated' WHERE title = 'Test';

-- Check updated_at was set
SELECT updated_at FROM conversations WHERE title = 'Updated';
```

### Check Trigger Status
```sql
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public';
```

---

## Important Notes

- **Never modify** `auth.users` table directly - use Supabase Auth API
- **Test triggers** thoroughly before deploying to production
- **Use SECURITY DEFINER** only when necessary and with caution
- **Always set search_path** to prevent SQL injection
- **Handle errors** appropriately in critical functions
- **Document** custom functions for future maintenance
- **Consider performance** - functions run on every trigger event

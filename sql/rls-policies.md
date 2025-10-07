# Row Level Security (RLS) Policies

Complete documentation of security policies for all tables.

## Overview

Row Level Security (RLS) ensures users can only access data they're authorized to see. All tables in the database have RLS enabled with specific policies for different operations.

## Key Concepts

- **RLS is enabled** on all tables
- **Policies** control SELECT, INSERT, UPDATE, and DELETE operations
- **auth.uid()** returns the current authenticated user's ID
- **auth.email()** returns the current authenticated user's email
- Policies use **USING** clause for reads and **WITH CHECK** for writes

---

## profiles Table

Users can only manage their own profile data.

### SELECT Policy: "Users can view their own profile"
```sql
USING (auth.uid() = id)
```
**Effect**: Users can only SELECT their own profile row.

### INSERT Policy: "Users can insert their own profile"
```sql
WITH CHECK (auth.uid() = id)
```
**Effect**: Users can only INSERT a profile for themselves.

### UPDATE Policy: "Users can update their own profile"
```sql
USING (auth.uid() = id)
```
**Effect**: Users can only UPDATE their own profile.

### DELETE Policy
❌ **No DELETE policy** - Profiles cannot be deleted directly (managed by auth system).

---

## conversations Table

Complex policies handle private, shared, and public conversations.

### SELECT Policy: "Users can view their own conversations"
```sql
USING (auth.uid() = user_id)
```
**Effect**: Users can view conversations they own.

### SELECT Policy: "Users can view conversations shared with them"
```sql
USING (
  (auth.uid() = user_id) OR 
  (privacy = 'public') OR 
  ((privacy = 'shared') AND (shared_with ? auth.email()))
)
```
**Effect**: Users can view:
- Their own conversations
- Public conversations
- Conversations explicitly shared with their email

### SELECT Policy: "Anyone can view conversations with valid public token"
```sql
USING (
  (auth.uid() = user_id) OR 
  ((privacy = 'public') AND (public_share_token IS NOT NULL)) OR 
  ((privacy = 'shared') AND (shared_with ? auth.email()))
)
```
**Effect**: Unauthenticated users can view public conversations with tokens.

### INSERT Policy: "Users can create their own conversations"
```sql
WITH CHECK (auth.uid() = user_id)
```
**Effect**: Users can only create conversations for themselves.

### UPDATE Policy: "Users can update their own conversations"
```sql
USING (auth.uid() = user_id)
```
**Effect**: Users can only update conversations they own.

### DELETE Policy: "Users can delete their own conversations"
```sql
USING (auth.uid() = user_id)
```
**Effect**: Users can only delete conversations they own.

---

## messages Table

Message access follows conversation access rules.

### SELECT Policy: "Users can view messages from their conversations"
```sql
USING (
  EXISTS (
    SELECT 1 FROM conversations 
    WHERE conversations.id = messages.conversation_id 
    AND conversations.user_id = auth.uid()
  )
)
```
**Effect**: Users can view messages in their own conversations.

### SELECT Policy: "Users can view messages from shared conversations"
```sql
USING (
  EXISTS (
    SELECT 1 FROM conversations 
    WHERE conversations.id = messages.conversation_id 
    AND (
      conversations.user_id = auth.uid() OR
      conversations.privacy = 'public' OR
      (conversations.privacy = 'shared' AND conversations.shared_with ? auth.email())
    )
  )
)
```
**Effect**: Users can view messages in conversations they have access to.

### SELECT Policy: "Anyone can view messages from public conversations"
```sql
USING (
  EXISTS (
    SELECT 1 FROM conversations 
    WHERE conversations.id = messages.conversation_id 
    AND conversations.privacy = 'public' 
    AND conversations.public_share_token IS NOT NULL
  )
)
```
**Effect**: Unauthenticated users can view messages in public conversations.

### INSERT Policy: "Users can create messages in their conversations"
```sql
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversations 
    WHERE conversations.id = messages.conversation_id 
    AND conversations.user_id = auth.uid()
  )
)
```
**Effect**: Users can only add messages to their own conversations.

### DELETE Policy: "Users can delete messages from their conversations"
```sql
USING (
  EXISTS (
    SELECT 1 FROM conversations 
    WHERE conversations.id = messages.conversation_id 
    AND conversations.user_id = auth.uid()
  )
)
```
**Effect**: Users can only delete messages from their own conversations.

### UPDATE Policy
❌ **No UPDATE policy** - Messages are immutable once created.

---

## conversation_files Table

File access follows conversation access rules.

### SELECT Policy: "Users can view files from their conversations"
```sql
USING (
  EXISTS (
    SELECT 1 FROM conversations 
    WHERE conversations.id = conversation_files.conversation_id 
    AND conversations.user_id = auth.uid()
  )
)
```

### SELECT Policy: "Users can view files from shared conversations"
```sql
USING (
  EXISTS (
    SELECT 1 FROM conversations 
    WHERE conversations.id = conversation_files.conversation_id 
    AND (
      conversations.user_id = auth.uid() OR
      conversations.privacy = 'public' OR
      (conversations.privacy = 'shared' AND conversations.shared_with ? auth.email())
    )
  )
)
```

### SELECT Policy: "Anyone can view files from public conversations"
```sql
USING (
  EXISTS (
    SELECT 1 FROM conversations 
    WHERE conversations.id = conversation_files.conversation_id 
    AND conversations.privacy = 'public' 
    AND conversations.public_share_token IS NOT NULL
  )
)
```

### INSERT Policy: "Users can create files in their conversations"
```sql
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversations 
    WHERE conversations.id = conversation_files.conversation_id 
    AND conversations.user_id = auth.uid()
  )
)
```

### DELETE Policy: "Users can delete files from their conversations"
```sql
USING (
  EXISTS (
    SELECT 1 FROM conversations 
    WHERE conversations.id = conversation_files.conversation_id 
    AND conversations.user_id = auth.uid()
  )
)
```

### UPDATE Policy
❌ **No UPDATE policy** - File records are immutable.

---

## message_reactions Table

Users can manage their own reactions.

### SELECT Policy: "Users can view all reactions"
```sql
USING (true)
```
**Effect**: All reactions are publicly visible (for display purposes).

### INSERT Policy: "Users can insert their own reactions"
```sql
WITH CHECK (auth.uid() = user_id)
```
**Effect**: Users can only create reactions as themselves.

### UPDATE Policy: "Users can update their own reactions"
```sql
USING (auth.uid() = user_id)
```
**Effect**: Users can only modify their own reactions.

### DELETE Policy: "Users can delete their own reactions"
```sql
USING (auth.uid() = user_id)
```
**Effect**: Users can only remove their own reactions.

---

## conversation_views Table

Users can track when they view conversations.

### SELECT Policy: "Users can view their own view records"
```sql
USING (user_email = auth.email())
```
**Effect**: Users can see when they viewed conversations.

### INSERT Policy: "Users can insert their own view records"
```sql
WITH CHECK (user_email = auth.email())
```
**Effect**: Users can only create view records for themselves.

### UPDATE Policy: "Users can update their own view records"
```sql
USING (user_email = auth.email())
```
**Effect**: Users can update their own view timestamps.

### DELETE Policy
❌ **No DELETE policy** - View records are permanent for analytics.

---

## Storage Policies (conversation-files bucket)

### SELECT: "Users can view files from accessible conversations"
```sql
(bucket_id = 'conversation-files') AND
EXISTS (
  SELECT 1 FROM conversation_files cf
  JOIN conversations c ON c.id = cf.conversation_id
  WHERE cf.file_path = name
  AND (
    c.user_id = auth.uid() OR
    c.privacy = 'public' OR
    (c.privacy = 'shared' AND c.shared_with ? auth.email())
  )
)
```

### INSERT: "Users can upload files to their conversations"
```sql
(bucket_id = 'conversation-files') AND
(auth.uid()::text = (storage.foldername(name))[1])
```

### UPDATE: "Users can update their own files"
```sql
(bucket_id = 'conversation-files') AND
(auth.uid()::text = (storage.foldername(name))[1])
```

### DELETE: "Users can delete their own files"
```sql
(bucket_id = 'conversation-files') AND
(auth.uid()::text = (storage.foldername(name))[1])
```

---

## Security Testing

### Test Private Conversations
```typescript
// Should fail - accessing another user's private conversation
const { data, error } = await supabase
  .from('conversations')
  .select('*')
  .eq('id', someOtherUsersConversationId);
// error: 'new row violates row-level security policy'
```

### Test Shared Conversations
```typescript
// Should succeed if user's email is in shared_with
const { data, error } = await supabase
  .from('conversations')
  .select('*')
  .eq('privacy', 'shared');
// Returns only conversations shared with current user
```

### Test Public Conversations
```typescript
// Should succeed for anyone (even unauthenticated)
const { data, error } = await supabase
  .from('conversations')
  .select('*')
  .eq('privacy', 'public');
// Returns all public conversations
```

---

## Important Security Notes

1. **Always test RLS policies** with different user accounts
2. **Never disable RLS** on production tables
3. **Use auth.uid() and auth.email()** for user identification
4. **Cascade policies** - child tables inherit parent access rules
5. **Public access** requires explicit public_share_token check
6. **JSONB operations** use `?` operator to check array membership
7. **EXISTS subqueries** efficiently check related table access
8. **Storage policies** must match database policies for files

## Common Policy Patterns

### Owner-Only Access
```sql
-- SELECT, UPDATE, DELETE
USING (auth.uid() = user_id)

-- INSERT
WITH CHECK (auth.uid() = user_id)
```

### Inherited Access (via parent table)
```sql
USING (
  EXISTS (
    SELECT 1 FROM parent_table
    WHERE parent_table.id = child_table.parent_id
    AND parent_table.user_id = auth.uid()
  )
)
```

### Public + Shared Access
```sql
USING (
  (user_id = auth.uid()) OR
  (privacy = 'public' AND public_share_token IS NOT NULL) OR
  (privacy = 'shared' AND shared_with ? auth.email())
)
```

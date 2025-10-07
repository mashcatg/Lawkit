# Database Relationships

Visual representation and explanation of table relationships.

## Entity Relationship Diagram

```
┌─────────────┐
│   profiles  │
│─────────────│
│ id (PK)     │◄──┐
│ full_name   │   │
│ email       │   │
└─────────────┘   │
                  │
                  │ user_id (FK)
                  │
┌─────────────────┴───────┐
│   conversations         │
│─────────────────────────│
│ id (PK)                 │◄────────────────┐
│ user_id (FK)            │                 │
│ title                   │                 │
│ privacy                 │                 │
│ shared_with             │                 │
└─────────────────────────┘                 │
          │                                 │
          │                                 │
          │ conversation_id (FK)            │
          ├─────────────────┬───────────────┤
          │                 │               │
          ▼                 ▼               │
┌─────────────────┐  ┌──────────────────┐  │
│    messages     │  │ conversation_files│ │
│─────────────────│  │──────────────────│  │
│ id (PK)         │  │ id (PK)          │  │
│ conversation_id │  │ conversation_id  │  │
│ role            │  │ message_id (FK)  │──┘
│ content         │  │ file_name        │
└─────────────────┘  │ file_path        │
          │          └──────────────────┘
          │
          │ message_id (FK)
          │
          ▼
┌──────────────────┐
│ message_reactions│
│──────────────────│
│ id (PK)          │
│ message_id (FK)  │
│ user_id (FK)     │
│ reaction_type    │
└──────────────────┘

┌─────────────────────┐
│ conversation_views  │
│─────────────────────│
│ id (PK)             │
│ conversation_id (FK)│
│ user_email          │
│ last_viewed_at      │
└─────────────────────┘
```

## Relationship Types

### One-to-Many Relationships

#### profiles → conversations
- **Type**: One-to-Many
- **Description**: A user (profile) can own multiple conversations
- **Foreign Key**: `conversations.user_id` → `profiles.id`
- **Cascade**: ON DELETE CASCADE (if user is deleted, their conversations are deleted)

#### conversations → messages
- **Type**: One-to-Many
- **Description**: A conversation contains multiple messages
- **Foreign Key**: `messages.conversation_id` → `conversations.id`
- **Cascade**: ON DELETE CASCADE (if conversation is deleted, its messages are deleted)

#### conversations → conversation_files
- **Type**: One-to-Many
- **Description**: A conversation can have multiple attached files
- **Foreign Key**: `conversation_files.conversation_id` → `conversations.id`
- **Cascade**: ON DELETE CASCADE (if conversation is deleted, its files are deleted)

#### messages → message_reactions
- **Type**: One-to-Many
- **Description**: A message can have multiple reactions from different users
- **Foreign Key**: `message_reactions.message_id` → `messages.id`
- **Cascade**: ON DELETE CASCADE (if message is deleted, its reactions are deleted)

#### conversations → conversation_views
- **Type**: One-to-Many
- **Description**: A conversation can be viewed by multiple users
- **Foreign Key**: `conversation_views.conversation_id` → `conversations.id`
- **Cascade**: ON DELETE CASCADE (if conversation is deleted, view records are deleted)

### Optional Relationships

#### messages → conversation_files
- **Type**: One-to-Many (optional)
- **Description**: A message can optionally have attached files
- **Foreign Key**: `conversation_files.message_id` → `messages.id` (nullable)
- **Cascade**: ON DELETE CASCADE
- **Note**: Files can be attached to conversations without specific messages

## Data Flow Patterns

### Creating a New Conversation

```
1. User signs up/logs in
   → Profile created/retrieved in profiles table

2. User starts new conversation
   → Insert into conversations (user_id = current user)

3. User sends first message
   → Insert into messages (conversation_id = new conversation)

4. User uploads files (optional)
   → Insert into conversation_files (conversation_id, message_id)
   → Files stored in conversation-files bucket
```

### Message with Reactions

```
1. Assistant sends response
   → Insert into messages (role = 'assistant')

2. User likes the message
   → Insert into message_reactions (message_id, reaction_type = 'like')

3. User changes to dislike
   → Update message_reactions (reaction_type = 'dislike')

4. User removes reaction
   → Delete from message_reactions
```

### Sharing Conversations

```
1. User creates conversation
   → privacy = 'private' by default

2. User shares with specific emails
   → Update conversations (privacy = 'shared', shared_with = ['email@example.com'])

3. Shared user views conversation
   → RLS policy checks shared_with array
   → Insert/Update conversation_views (user_email, last_viewed_at)

4. User makes conversation public
   → Update conversations (privacy = 'public')
   → Anyone with public_share_token can access
```

## Data Integrity Rules

### Cascading Deletes

All relationships use `ON DELETE CASCADE` to maintain referential integrity:

```sql
-- If a conversation is deleted:
DELETE FROM conversations WHERE id = 'some-uuid';

-- Automatically deletes:
-- - All messages in that conversation
-- - All conversation_files attached to it
-- - All message_reactions to those messages
-- - All conversation_views for it
```

### Unique Constraints

1. **message_reactions**: One reaction per user per message
   ```sql
   UNIQUE (message_id, user_id)
   ```

2. **conversation_views**: One view record per email per conversation
   ```sql
   UNIQUE (conversation_id, user_email)
   ```

## Query Patterns

### Fetch Conversation with Messages

```typescript
const { data } = await supabase
  .from('conversations')
  .select(`
    *,
    messages (
      *,
      message_reactions (*)
    ),
    conversation_files (*)
  `)
  .eq('id', conversationId)
  .single();
```

### Fetch User's Conversations with File Counts

```typescript
const { data } = await supabase
  .from('conversations')
  .select(`
    *,
    conversation_files (count)
  `)
  .eq('user_id', userId)
  .order('updated_at', { ascending: false });
```

### Fetch Message with Reactions

```typescript
const { data } = await supabase
  .from('messages')
  .select(`
    *,
    message_reactions (
      reaction_type,
      user_id
    )
  `)
  .eq('id', messageId)
  .single();
```

## Important Notes

- **Foreign keys** maintain referential integrity automatically
- **Cascade deletes** prevent orphaned records
- **RLS policies** enforce access control on relationships (see [rls-policies.md](./rls-policies.md))
- **Indexes** exist on all foreign key columns for query performance
- **Nullable FKs** (like message_id in conversation_files) allow optional relationships

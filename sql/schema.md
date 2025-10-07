# Database Schema

Complete table schemas for the Lawkit AI application.

## profiles

Stores user profile information synced from authentication.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | - | Primary key, references auth.users |
| full_name | text | Yes | - | User's full name |
| email | text | Yes | - | User's email address |
| avatar_url | text | Yes | - | URL to user's profile picture |
| created_at | timestamp with time zone | Yes | now() | When profile was created |
| updated_at | timestamp with time zone | Yes | now() | Last update timestamp |

**Indexes:**
- Primary key on `id`

**Triggers:**
- `update_profiles_updated_at` - Updates `updated_at` on row changes

---

## conversations

Main table for conversation/chat sessions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | gen_random_uuid() | Primary key |
| user_id | uuid | No | - | Owner of the conversation |
| title | text | No | 'New Conversation' | Conversation title |
| privacy | text | Yes | 'private' | Privacy setting: 'private', 'shared', or 'public' |
| shared_with | jsonb | Yes | '[]' | Array of emails for shared access |
| public_share_token | uuid | Yes | gen_random_uuid() | Token for public sharing |
| created_at | timestamp with time zone | No | now() | Creation timestamp |
| updated_at | timestamp with time zone | No | now() | Last update timestamp |

**Indexes:**
- Primary key on `id`
- Index on `user_id` for fast user lookups
- Index on `public_share_token` for public access

**Triggers:**
- `update_conversations_updated_at` - Updates `updated_at` on row changes

---

## messages

Individual messages within conversations.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | gen_random_uuid() | Primary key |
| conversation_id | uuid | No | - | Reference to parent conversation |
| role | text | No | - | Message role: 'user' or 'assistant' |
| content | text | No | - | Message text content |
| created_at | timestamp with time zone | No | now() | When message was sent |

**Indexes:**
- Primary key on `id`
- Index on `conversation_id` for conversation queries
- Index on `created_at` for chronological sorting

**Foreign Keys:**
- `conversation_id` references `conversations(id)` ON DELETE CASCADE

---

## conversation_files

Files attached to conversations and messages.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | gen_random_uuid() | Primary key |
| conversation_id | uuid | No | - | Reference to parent conversation |
| message_id | uuid | Yes | - | Optional reference to specific message |
| file_name | text | No | - | Original filename |
| file_path | text | No | - | Storage path in bucket |
| file_type | text | Yes | - | MIME type of file |
| file_size | integer | Yes | - | File size in bytes |
| created_at | timestamp with time zone | No | now() | Upload timestamp |

**Indexes:**
- Primary key on `id`
- Index on `conversation_id` for conversation file lookups
- Index on `message_id` for message attachments

**Foreign Keys:**
- `conversation_id` references `conversations(id)` ON DELETE CASCADE
- `message_id` references `messages(id)` ON DELETE CASCADE

---

## message_reactions

User reactions to messages (like/dislike).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | gen_random_uuid() | Primary key |
| message_id | uuid | No | - | Reference to message |
| user_id | uuid | No | - | User who reacted |
| reaction_type | text | No | - | Reaction: 'like' or 'dislike' |
| created_at | timestamp with time zone | No | now() | When reaction was added |

**Indexes:**
- Primary key on `id`
- Index on `message_id` for message reaction queries
- Unique constraint on `(message_id, user_id)` - one reaction per user per message

**Foreign Keys:**
- `message_id` references `messages(id)` ON DELETE CASCADE
- `user_id` references `profiles(id)` ON DELETE CASCADE

---

## conversation_views

Tracks when users view shared conversations.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | gen_random_uuid() | Primary key |
| conversation_id | uuid | No | - | Reference to conversation |
| user_email | text | No | - | Email of viewer |
| last_viewed_at | timestamp with time zone | Yes | now() | Last view timestamp |

**Indexes:**
- Primary key on `id`
- Index on `conversation_id` for conversation view tracking
- Unique constraint on `(conversation_id, user_email)` - one record per user per conversation

**Foreign Keys:**
- `conversation_id` references `conversations(id)` ON DELETE CASCADE

---

## Storage Buckets

### conversation-files

Stores uploaded files for conversations.

| Property | Value |
|----------|-------|
| Bucket ID | conversation-files |
| Public | Yes |
| File size limit | 50MB |
| Allowed MIME types | All |

**Storage policies** ensure users can only access files from:
- Their own conversations
- Conversations shared with them
- Public conversations

---

## Notes

- All `id` columns use `gen_random_uuid()` for security
- All tables have `created_at` timestamps
- Tables with mutable data have `updated_at` with auto-update triggers
- Foreign keys use `ON DELETE CASCADE` to maintain referential integrity
- RLS is enabled on all tables (see [rls-policies.md](./rls-policies.md))

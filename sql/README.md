# Database Documentation

This folder contains comprehensive documentation for the Lawkit AI database architecture.

## Overview

The Lawkit AI application uses Lovable Cloud (powered by Supabase) for its backend infrastructure, providing:
- **PostgreSQL Database** for data persistence
- **Row Level Security (RLS)** for data access control
- **Edge Functions** for serverless backend logic
- **Real-time subscriptions** for collaborative features
- **Storage buckets** for file management

## Database Tables

The application uses the following main tables:

1. **profiles** - User profile information
2. **conversations** - Main conversation records
3. **messages** - Individual messages within conversations
4. **conversation_files** - Files attached to conversations
5. **message_reactions** - User reactions (like/dislike) to messages
6. **conversation_views** - Tracks when users view shared conversations

## Documentation Files

- **[schema.md](./schema.md)** - Complete table schemas with column details
- **[relationships.md](./relationships.md)** - Data relationships and foreign keys
- **[rls-policies.md](./rls-policies.md)** - Row Level Security policies explained
- **[functions.md](./functions.md)** - Database functions and triggers
- **[migrations-guide.md](./migrations-guide.md)** - How to modify the database
- **[api-reference.md](./api-reference.md)** - Frontend query examples

## Quick Start

### Querying Data

```typescript
import { supabase } from "@/integrations/supabase/client";

// Select conversations for current user
const { data, error } = await supabase
  .from('conversations')
  .select('*')
  .order('updated_at', { ascending: false });
```

### Inserting Data

```typescript
// Create a new conversation
const { data, error } = await supabase
  .from('conversations')
  .insert({
    user_id: user.id,
    title: 'New Conversation',
    privacy: 'private'
  })
  .select()
  .single();
```

### Making Database Changes

All database modifications must be done through **migrations** using the Lovable migration tool. Never edit the database directly.

See [migrations-guide.md](./migrations-guide.md) for detailed instructions.

## Security

The database implements **Row Level Security (RLS)** on all tables to ensure:
- Users can only access their own data
- Shared conversations are properly controlled
- Public conversations follow defined access rules

See [rls-policies.md](./rls-policies.md) for complete security details.

## Edge Functions

The application uses several edge functions for backend logic:
- `send-prompt` - Sends user prompts to n8n webhook
- `send-feedback` - Handles message reactions
- `send-file-upload` - Notifies when files are uploaded
- `save-document` - Saves document edits
- `send-share-notification` - Notifies users when conversations are shared

## Support

For questions about the database:
1. Check the documentation files in this folder
2. Review the RLS policies for access control issues
3. Consult the API reference for query examples
4. Check Edge Function logs for backend issues

## Important Notes

- **Never modify** `src/integrations/supabase/types.ts` - it's auto-generated
- **Never modify** `src/integrations/supabase/client.ts` - it's auto-configured
- **Never modify** `.env` file - environment variables are auto-managed
- **Always use migrations** for schema changes
- **Test RLS policies** thoroughly before deploying

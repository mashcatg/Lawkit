# Frontend API Reference

How to query and manipulate data from your React application.

## Setup

```typescript
import { supabase } from "@/integrations/supabase/client";
```

The Supabase client is pre-configured and ready to use.

---

## Basic Queries

### Select All Rows

```typescript
const { data, error } = await supabase
  .from('conversations')
  .select('*');

if (error) {
  console.error('Error:', error);
} else {
  console.log('Data:', data);
}
```

### Select Specific Columns

```typescript
const { data, error } = await supabase
  .from('conversations')
  .select('id, title, created_at');
```

### Select with Filter

```typescript
const { data, error } = await supabase
  .from('conversations')
  .select('*')
  .eq('user_id', userId);
```

### Select Single Row

```typescript
const { data, error } = await supabase
  .from('conversations')
  .select('*')
  .eq('id', conversationId)
  .single();

// data is an object, not an array
```

---

## Filtering

### Equal To

```typescript
.eq('privacy', 'private')
```

### Not Equal To

```typescript
.neq('privacy', 'private')
```

### Greater Than / Less Than

```typescript
.gt('created_at', '2024-01-01')
.lt('created_at', '2024-12-31')
.gte('created_at', '2024-01-01')  // greater than or equal
.lte('created_at', '2024-12-31')  // less than or equal
```

### Text Search

```typescript
.like('title', '%search%')        // case sensitive
.ilike('title', '%search%')       // case insensitive
.textSearch('content', 'phrase')  // full text search
```

### In / Not In

```typescript
.in('privacy', ['private', 'shared'])
.not('privacy', 'in', '(public)')
```

### Is Null / Not Null

```typescript
.is('public_share_token', null)
.not('public_share_token', 'is', null)
```

### Or Conditions

```typescript
.or('privacy.eq.public,privacy.eq.shared')
```

### Multiple Filters (AND)

```typescript
const { data } = await supabase
  .from('conversations')
  .select('*')
  .eq('user_id', userId)
  .eq('privacy', 'private')
  .gte('created_at', startDate);
```

---

## Ordering and Limiting

### Order By

```typescript
// Ascending
.order('created_at', { ascending: true })

// Descending
.order('created_at', { ascending: false })

// Multiple columns
.order('privacy', { ascending: true })
.order('updated_at', { ascending: false })
```

### Limit and Range

```typescript
// Limit results
.limit(10)

// Pagination with range
.range(0, 9)    // First 10 items
.range(10, 19)  // Next 10 items
```

---

## Joins and Relationships

### Inner Join (select related data)

```typescript
const { data } = await supabase
  .from('conversations')
  .select(`
    *,
    messages (
      id,
      content,
      created_at
    )
  `)
  .eq('user_id', userId);

// Returns conversations with nested messages array
```

### Multiple Joins

```typescript
const { data } = await supabase
  .from('conversations')
  .select(`
    *,
    messages (
      id,
      content,
      message_reactions (
        reaction_type,
        user_id
      )
    ),
    conversation_files (
      file_name,
      file_path
    )
  `)
  .eq('id', conversationId)
  .single();
```

### Count Related Records

```typescript
const { data } = await supabase
  .from('conversations')
  .select(`
    *,
    messages:messages(count)
  `);

// Returns: { ..., messages: [{ count: 5 }] }
```

### Filter on Joined Tables

```typescript
const { data } = await supabase
  .from('conversations')
  .select(`
    *,
    messages!inner (
      id,
      content
    )
  `)
  .eq('messages.role', 'assistant');
```

---

## Inserting Data

### Insert Single Row

```typescript
const { data, error } = await supabase
  .from('conversations')
  .insert({
    user_id: userId,
    title: 'New Conversation',
    privacy: 'private'
  })
  .select()
  .single();

// data contains the inserted row with generated fields
```

### Insert Multiple Rows

```typescript
const { data, error } = await supabase
  .from('messages')
  .insert([
    { conversation_id: convId, role: 'user', content: 'Hello' },
    { conversation_id: convId, role: 'assistant', content: 'Hi!' }
  ])
  .select();
```

### Insert and Return Specific Columns

```typescript
const { data } = await supabase
  .from('conversations')
  .insert({ user_id: userId, title: 'New' })
  .select('id, created_at');
```

---

## Updating Data

### Update with Filter

```typescript
const { data, error } = await supabase
  .from('conversations')
  .update({ title: 'Updated Title' })
  .eq('id', conversationId)
  .select();
```

### Update Multiple Fields

```typescript
const { data } = await supabase
  .from('conversations')
  .update({
    title: 'New Title',
    privacy: 'public',
    updated_at: new Date().toISOString()
  })
  .eq('id', conversationId);
```

### Increment a Value

```typescript
const { data } = await supabase.rpc('increment_view_count', {
  conversation_id: convId
});
```

---

## Deleting Data

### Delete with Filter

```typescript
const { error } = await supabase
  .from('conversations')
  .delete()
  .eq('id', conversationId);
```

### Delete Multiple Rows

```typescript
const { error } = await supabase
  .from('message_reactions')
  .delete()
  .eq('message_id', messageId)
  .eq('user_id', userId);
```

---

## Real-time Subscriptions

### Subscribe to Inserts

```typescript
const channel = supabase
  .channel('messages')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`
    },
    (payload) => {
      console.log('New message:', payload.new);
      // Update your UI with the new message
    }
  )
  .subscribe();

// Clean up
return () => {
  supabase.removeChannel(channel);
};
```

### Subscribe to All Changes

```typescript
const channel = supabase
  .channel('conversation_changes')
  .on(
    'postgres_changes',
    {
      event: '*',  // INSERT, UPDATE, DELETE
      schema: 'public',
      table: 'conversations',
      filter: `user_id=eq.${userId}`
    },
    (payload) => {
      console.log('Change type:', payload.eventType);
      console.log('New data:', payload.new);
      console.log('Old data:', payload.old);
    }
  )
  .subscribe();
```

### React Hook Example

```typescript
useEffect(() => {
  if (!conversationId) return;

  const channel = supabase
    .channel(`conversation-${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      },
      (payload) => {
        setMessages(prev => [...prev, payload.new]);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [conversationId]);
```

---

## File Storage

### Upload File

```typescript
const { data, error } = await supabase.storage
  .from('conversation-files')
  .upload(`${userId}/${conversationId}_${fileName}`, file, {
    cacheControl: '3600',
    upsert: false
  });
```

### Get Public URL

```typescript
const { data } = supabase.storage
  .from('conversation-files')
  .getPublicUrl(filePath);

console.log('Public URL:', data.publicUrl);
```

### Download File

```typescript
const { data, error } = await supabase.storage
  .from('conversation-files')
  .download(filePath);

// data is a Blob
```

### Delete File

```typescript
const { error } = await supabase.storage
  .from('conversation-files')
  .remove([filePath]);
```

### List Files

```typescript
const { data, error } = await supabase.storage
  .from('conversation-files')
  .list(`${userId}`, {
    limit: 100,
    offset: 0,
    sortBy: { column: 'created_at', order: 'desc' }
  });
```

---

## Calling Edge Functions

### Basic Function Call

```typescript
const { data, error } = await supabase.functions.invoke('send-prompt', {
  body: {
    conversationId: convId,
    prompt: 'Hello AI',
    userId: userId
  }
});
```

### With Headers

```typescript
const { data, error } = await supabase.functions.invoke('send-prompt', {
  body: { prompt: 'Hello' },
  headers: {
    'Custom-Header': 'value'
  }
});
```

---

## Error Handling

### Check for Errors

```typescript
const { data, error } = await supabase
  .from('conversations')
  .select('*');

if (error) {
  console.error('Database error:', error.message);
  return;
}

// Use data safely
console.log(data);
```

### Toast Notifications

```typescript
import { toast } from "@/hooks/use-toast";

const { data, error } = await supabase
  .from('conversations')
  .insert({ ... });

if (error) {
  toast({
    title: "Error",
    description: "Failed to create conversation",
    variant: "destructive"
  });
} else {
  toast({
    description: "Conversation created successfully"
  });
}
```

---

## TypeScript Types

### Using Generated Types

```typescript
import { Database } from "@/integrations/supabase/types";

type Conversation = Database['public']['Tables']['conversations']['Row'];
type ConversationInsert = Database['public']['Tables']['conversations']['Insert'];
type ConversationUpdate = Database['public']['Tables']['conversations']['Update'];
```

### Typed Queries

```typescript
const { data, error } = await supabase
  .from('conversations')
  .select('*')
  .returns<Conversation[]>();
```

---

## Advanced Patterns

### Transaction-like Operations

```typescript
// Insert conversation, then message
const { data: conversation, error: convError } = await supabase
  .from('conversations')
  .insert({ user_id: userId, title: 'New' })
  .select()
  .single();

if (convError) throw convError;

const { data: message, error: msgError } = await supabase
  .from('messages')
  .insert({
    conversation_id: conversation.id,
    role: 'user',
    content: 'Hello'
  })
  .select()
  .single();

if (msgError) throw msgError;
```

### Upsert (Insert or Update)

```typescript
const { data, error } = await supabase
  .from('conversation_views')
  .upsert({
    conversation_id: convId,
    user_email: email,
    last_viewed_at: new Date().toISOString()
  }, {
    onConflict: 'conversation_id,user_email'
  });
```

### Batch Operations

```typescript
// Delete all reactions for a message
const { error } = await supabase
  .from('message_reactions')
  .delete()
  .eq('message_id', messageId);

// Insert multiple in one call
const { data } = await supabase
  .from('messages')
  .insert(messagesArray);
```

---

## Performance Tips

### Use Indexes

```sql
-- Ensure indexes exist for filtered columns
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
```

### Select Only Needed Columns

```typescript
// Bad: Fetches all columns
.select('*')

// Good: Fetches only needed columns
.select('id, title, created_at')
```

### Paginate Large Results

```typescript
const pageSize = 20;
const page = 1;

const { data } = await supabase
  .from('conversations')
  .select('*')
  .range(page * pageSize, (page + 1) * pageSize - 1)
  .order('created_at', { ascending: false });
```

### Use Count for Large Tables

```typescript
const { count } = await supabase
  .from('conversations')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', userId);

console.log('Total conversations:', count);
```

---

## Common Patterns

### Load Conversation with All Related Data

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

### Create Conversation with First Message

```typescript
const { data: conversation } = await supabase
  .from('conversations')
  .insert({ user_id: userId, title: 'New Chat' })
  .select()
  .single();

await supabase
  .from('messages')
  .insert({
    conversation_id: conversation.id,
    role: 'user',
    content: 'Hello'
  });
```

### Toggle Reaction

```typescript
const { data: existing } = await supabase
  .from('message_reactions')
  .select('*')
  .eq('message_id', messageId)
  .eq('user_id', userId)
  .maybeSingle();

if (existing) {
  if (existing.reaction_type === reactionType) {
    // Remove reaction
    await supabase
      .from('message_reactions')
      .delete()
      .eq('id', existing.id);
  } else {
    // Change reaction
    await supabase
      .from('message_reactions')
      .update({ reaction_type: reactionType })
      .eq('id', existing.id);
  }
} else {
  // Add reaction
  await supabase
    .from('message_reactions')
    .insert({
      message_id: messageId,
      user_id: userId,
      reaction_type: reactionType
    });
}
```

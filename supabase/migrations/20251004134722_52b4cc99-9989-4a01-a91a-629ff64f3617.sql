-- Add privacy and sharing columns to conversations table
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS privacy text DEFAULT 'private' CHECK (privacy IN ('private', 'shared', 'public')),
ADD COLUMN IF NOT EXISTS shared_with jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS public_share_token uuid DEFAULT gen_random_uuid();

-- Create index for public share token lookups
CREATE INDEX IF NOT EXISTS idx_conversations_public_share_token 
ON public.conversations(public_share_token) 
WHERE privacy = 'public';

-- Update RLS policies to allow shared access
CREATE POLICY "Users can view conversations shared with them"
ON public.conversations
FOR SELECT
USING (
  auth.uid() = user_id OR
  privacy = 'public' OR
  (privacy = 'shared' AND shared_with ? auth.email()::text)
);

-- Update RLS policies for messages to allow shared access
CREATE POLICY "Users can view messages from shared conversations"
ON public.messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversations
    WHERE conversations.id = messages.conversation_id
    AND (
      conversations.user_id = auth.uid() OR
      conversations.privacy = 'public' OR
      (conversations.privacy = 'shared' AND conversations.shared_with ? auth.email()::text)
    )
  )
);

-- Update RLS policies for files to allow shared access
CREATE POLICY "Users can view files from shared conversations"
ON public.conversation_files
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversations
    WHERE conversations.id = conversation_files.conversation_id
    AND (
      conversations.user_id = auth.uid() OR
      conversations.privacy = 'public' OR
      (conversations.privacy = 'shared' AND conversations.shared_with ? auth.email()::text)
    )
  )
);
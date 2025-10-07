-- Create conversation_views table to track read status
CREATE TABLE IF NOT EXISTS public.conversation_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  user_email text NOT NULL,
  last_viewed_at timestamptz DEFAULT now(),
  UNIQUE(conversation_id, user_email)
);

-- Enable RLS on conversation_views
ALTER TABLE public.conversation_views ENABLE ROW LEVEL SECURITY;

-- Users can view their own view records
CREATE POLICY "Users can view their own view records"
ON public.conversation_views
FOR SELECT
USING (user_email = auth.email());

-- Users can insert their own view records
CREATE POLICY "Users can insert their own view records"
ON public.conversation_views
FOR INSERT
WITH CHECK (user_email = auth.email());

-- Users can update their own view records
CREATE POLICY "Users can update their own view records"
ON public.conversation_views
FOR UPDATE
USING (user_email = auth.email());

-- Add policy to allow accessing conversations by public_share_token
CREATE POLICY "Anyone can view conversations with valid public token"
ON public.conversations
FOR SELECT
USING (
  (auth.uid() = user_id) OR 
  (privacy = 'public' AND public_share_token IS NOT NULL) OR
  ((privacy = 'shared') AND (shared_with ? auth.email()))
);

-- Allow reading messages from public conversations
CREATE POLICY "Anyone can view messages from public conversations"
ON public.messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversations
    WHERE conversations.id = messages.conversation_id
    AND (
      conversations.user_id = auth.uid() OR
      (conversations.privacy = 'public' AND conversations.public_share_token IS NOT NULL) OR
      ((conversations.privacy = 'shared') AND (conversations.shared_with ? auth.email()))
    )
  )
);

-- Allow reading files from public conversations
CREATE POLICY "Anyone can view files from public conversations"
ON public.conversation_files
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversations
    WHERE conversations.id = conversation_files.conversation_id
    AND (
      conversations.user_id = auth.uid() OR
      (conversations.privacy = 'public' AND conversations.public_share_token IS NOT NULL) OR
      ((conversations.privacy = 'shared') AND (conversations.shared_with ? auth.email()))
    )
  )
);
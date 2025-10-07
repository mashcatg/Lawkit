import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface ConversationFile {
  id: string;
  conversation_id: string;
  message_id?: string;
  file_name: string;
  file_path: string;
  file_size?: number;
  file_type?: string;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  files?: ConversationFile[];
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  privacy?: string;
  shared_with?: any;
  public_share_token?: string;
}

export const useConversation = (conversationId?: string, user?: any) => {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationFiles, setConversationFiles] = useState<ConversationFile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (conversationId && user) {
      loadConversation();
      loadMessages();
      loadConversationFiles();
    }
  }, [conversationId, user]);

  const loadConversation = async () => {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

      if (error) throw error;
      setConversation(data);
    } catch (error) {
      console.error('Error loading conversation:', error);
      toast({ description: 'Failed to load conversation', variant: 'destructive' });
    }
  };

  const loadMessages = async () => {
    try {
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      const { data: filesData, error: filesError } = await supabase
        .from('conversation_files')
        .select('*')
        .eq('conversation_id', conversationId);

      if (filesError) throw filesError;

      const messagesWithFiles = messagesData.map(msg => ({
        ...msg,
        role: msg.role as 'user' | 'assistant',
        files: filesData.filter(f => f.message_id === msg.id)
      }));

      setMessages(messagesWithFiles);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast({ description: 'Failed to load messages', variant: 'destructive' });
    }
  };

  const loadConversationFiles = async () => {
    try {
      const { data, error } = await supabase
        .from('conversation_files')
        .select('*')
        .eq('conversation_id', conversationId);

      if (error) throw error;
      setConversationFiles(data || []);
    } catch (error) {
      console.error('Error loading conversation files:', error);
    }
  };

  const createConversation = async () => {
    if (!user) {
      console.error('Cannot create conversation: user is not authenticated');
      toast({ description: 'Please login to create a conversation', variant: 'destructive' });
      return null;
    }

    try {
      console.log('Creating conversation for user:', user.id);
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          title: 'New Conversation'
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase error creating conversation:', error);
        throw error;
      }
      console.log('Conversation created successfully:', data);
      return data;
    } catch (error: any) {
      console.error('Error creating conversation:', error);
      const errorMessage = error?.message || 'Failed to create conversation';
      toast({ 
        description: errorMessage,
        variant: 'destructive' 
      });
      return null;
    }
  };

  const updateConversationTitle = async (convId: string, title: string) => {
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ title })
        .eq('id', convId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating conversation title:', error);
      toast({ description: 'Failed to update conversation title', variant: 'destructive' });
    }
  };

  const addMessage = async (convId: string, role: 'user' | 'assistant', content: string) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: convId,
          role,
          content
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding message:', error);
      toast({ description: 'Failed to add message', variant: 'destructive' });
      return null;
    }
  };

  const uploadFile = async (
    convId: string,
    file: File,
    messageId?: string
  ): Promise<ConversationFile | null> => {
    if (!user) return null;

    try {
      const fileExt = file.name?.split('.')?.pop() || 'unknown';
      const fileName = `${convId}_files-${file.name}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('conversation-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: fileRecord, error: fileError } = await supabase
        .from('conversation_files')
        .insert({
          conversation_id: convId,
          message_id: messageId,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          file_type: file.type
        })
        .select()
        .single();

      if (fileError) throw fileError;

      // Get public URL and notify n8n
      const { data: { publicUrl } } = supabase.storage
        .from('conversation-files')
        .getPublicUrl(filePath);

      // Send to file upload webhook
      await supabase.functions.invoke('send-file-upload', {
        body: {
          conversationId: convId,
          userId: user.id,
          files: [{
            name: file.name,
            url: publicUrl,
            type: file.type,
            size: file.size
          }]
        }
      }).catch(err => console.error('Error notifying file upload:', err));

      return fileRecord;
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({ description: 'Failed to upload file', variant: 'destructive' });
      return null;
    }
  };

  return {
    conversation,
    messages,
    setMessages,
    conversationFiles,
    loading,
    createConversation,
    updateConversationTitle,
    addMessage,
    uploadFile,
    loadMessages
  };
};

import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { MessageBubble } from "@/components/conversation/MessageBubble";
import { PromptBox } from "@/components/conversation/PromptBox";
import { DocumentEditor } from "@/components/document/DocumentEditor";
import { MessageSkeleton } from "@/components/loading/MessageSkeleton";
import { Button } from "@/components/ui/button";
import { ShareModal } from "@/components/modals/ShareModal";
import { ExportModal } from "@/components/modals/ExportModal";
import { SourcesModal } from "@/components/modals/SourcesModal";
import { Lock, Users, Globe, FileText, Calendar, Bot, Menu } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { useConversation } from "@/hooks/useConversation";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  files?: string[];
  versions?: { content: string; timestamp: string }[];
  reactions?: { likes: number; dislikes: number; userReaction?: "like" | "dislike" };
  docId?: string | null;
  docContent?: string | null;
  docTitle?: string | null;
}

const formatMessages = (msgs: any[]): DisplayMessage[] => {
  return msgs.map(msg => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    timestamp: new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    files: msg.files?.map((f: any) => f.file_name) || [],
    reactions: { likes: 0, dislikes: 0 }
  }));
};

const parseMessageContent = (content: string) => {
  try {
    const parsed = JSON.parse(content);
    if (parsed.text && parsed.docId) {
      return {
        text: parsed.text,
        docId: parsed.docId,
        docContent: parsed.docContent,
        docTitle: parsed.docTitle
      };
    }
  } catch (e) {
    // Not JSON, return as-is
  }
  return { text: content, docId: null, docContent: null, docTitle: null };
};

const ConversationDetailContent = () => {
  const { id: conversationId } = useParams();
  const { user } = useAuth();
  const { setOpen } = useSidebar();

  const { conversation, messages, setMessages, addMessage, uploadFile, loadMessages, conversationFiles } = useConversation(conversationId, user);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"ask" | "draft">("ask");
  const [deepResearch, setDeepResearch] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [promptValue, setPromptValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [privacy, setPrivacy] = useState<"private" | "shared" | "public">("private");
  const [showDocViewer, setShowDocViewer] = useState(false);
  const [sourcesModalOpen, setSourcesModalOpen] = useState(false);
  const [selectedFileUrl, setSelectedFileUrl] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [selectedDocContent, setSelectedDocContent] = useState<string | null>(null);
  const [selectedDocTitle, setSelectedDocTitle] = useState<string | null>(null);
  const [promptContext, setPromptContext] = useState<string>("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [conversationDocuments, setConversationDocuments] = useState<Map<string, { doc_content: string; doc_title: string | null }>>(new Map());
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Close document viewer when conversation changes (NOW AFTER STATE IS DECLARED)
  useEffect(() => {
    setShowDocViewer(false);
    setSelectedDocId(null);
    setSelectedDocContent(null);
    setSelectedDocTitle(null);
    setSelectedFileUrl(null);
    setSelectedFileName(null);
  }, [conversationId]);

  // Load documents from database for this conversation
  useEffect(() => {
    const loadDocuments = async () => {
      if (!conversationId || !user) return;
      
      try {
        const { data, error } = await supabase
          .from('documents')
          .select('doc_id, doc_content, doc_title')
          .eq('conversation_id', conversationId);
        
        if (error) throw error;
        
        // Create a Map for quick lookup by doc_id
        const docsMap = new Map();
        data?.forEach(doc => {
          docsMap.set(doc.doc_id, {
            doc_content: doc.doc_content,
            doc_title: doc.doc_title
          });
        });
        
        setConversationDocuments(docsMap);
      } catch (error) {
        console.error('Error loading documents:', error);
      }
    };
    
    loadDocuments();
  }, [conversationId, user, messages]); // Reload when messages change (new doc might be created)

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    if (conversation?.privacy) {
      setPrivacy(conversation.privacy as "private" | "shared" | "public");
    }
    if (conversation?.title && !isEditingTitle) {
      setEditedTitle(conversation.title);
    }
  }, [conversation?.privacy, conversation?.title, isEditingTitle]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFileUpload = async (files: File[]) => {
    setIsUploading(true);
    try {
      const newFiles = files.map((file) => ({
        id: Math.random().toString(),
        name: file.name,
        file,
      }));
      setUploadedFiles([...uploadedFiles, ...newFiles]);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileRemove = (fileId: string) => {
    setUploadedFiles(uploadedFiles.filter((f) => f.id !== fileId));
  };

  const handleContextSelect = (context: string, docId?: string) => {
    setPromptContext(context);
    // Store the docId if provided
    if (docId) {
      setSelectedDocId(docId);
    }
    // Prepend context visibly in the prompt box
    const contextPrefix = `Context: ${context}\n\nQuestion: `;
    setPromptValue(contextPrefix);
  };

  const handleSubmit = async () => {
    if (!promptValue.trim() || !conversationId || !user) return;

    // Prepend context to prompt if present
    const finalPrompt = promptContext 
      ? `Context: ${promptContext}\n\nQuestion: ${promptValue}`
      : promptValue;
    
    const userPrompt = finalPrompt;
    const originalUserPrompt = promptValue;
    const tempFiles = [...uploadedFiles];
    
    // Create optimistic user message for instant display
    const optimisticUserMessage: any = {
      id: `temp-${Date.now()}`,
      role: 'user' as const,
      content: userPrompt,
      created_at: new Date().toISOString(),
      conversation_id: conversationId,
      files: []
    };
    
    // Immediately show user message in UI
    setMessages([...messages, optimisticUserMessage]);
    setPromptValue("");
    setIsLoading(true);

    try {
      // Add to database
      const userMessage = await addMessage(conversationId, 'user', userPrompt);
      if (!userMessage) {
        toast({ description: "Failed to send message", variant: "destructive" });
        setPromptValue(userPrompt);
        setMessages(messages); // Revert optimistic update
        return;
      }

      // Upload files
      for (const fileItem of tempFiles) {
        await uploadFile(conversationId, fileItem.file, userMessage.id);
      }

      // Get user info
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      // Get file URLs
      const fileUrls = conversationFiles.map(f => {
        const publicUrl = supabase.storage.from('conversation-files').getPublicUrl(f.file_path).data.publicUrl;
        return {
          name: f.file_name,
          url: publicUrl
        };
      });

      // Get latest docId from database (not from message content)
      let latestDocId: string | null = null;
      try {
        const { data: latestDoc } = await supabase
          .from('documents')
          .select('doc_id')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        latestDocId = latestDoc?.doc_id || null;
      } catch (error) {
        console.error('Error fetching latest doc_id:', error);
      }

      const { data, error} = await supabase.functions.invoke('send-prompt', {
        body: {
          conversationId,
          userId: user.id,
          userName: profile?.full_name || 'User',
          userEmail: user.email || '',
          mode,
          deepResearch,
          prompt: userPrompt, // This includes context prepended
          originalPrompt: originalUserPrompt, // Original without context
          context: promptContext || undefined,
          docId: latestDocId,
          fileUrls,
          timestamp: new Date().toISOString()
        }
      });

      if (error) throw error;

      console.log('N8N Response:', data);
      console.log('Response field:', data.response);
      console.log('DocId:', data.docId);
      console.log('DocContent:', data.docContent);
      console.log('DocTitle:', data.docTitle);

      // Store the assistant's response with document metadata if present
      const messageContent = data.docId && data.docContent 
        ? JSON.stringify({
            text: data.response,
            docId: data.docId,
            docContent: data.docContent,
            docTitle: data.docTitle || 'Generated Document'
          })
        : data.response;

      const assistantMessage = await addMessage(conversationId, 'assistant', messageContent);
      
      // Handle document if present - auto-open with validation
      if (data.docId && data.docContent && typeof data.docContent === 'string' && data.docContent.trim() !== '') {
        let title = 'Generated Document';
        if (data.docTitle && typeof data.docTitle === 'string' && data.docTitle.trim() !== '') {
          // Normalize title
          title = data.docTitle.trim().replace(/^["'""'']|["'""'']$/g, '').replace(/,$/, '');
        }
        
        setSelectedDocId(data.docId);
        setSelectedDocContent(data.docContent);
        setSelectedDocTitle(title);
        setSelectedFileUrl(null);
        setSelectedFileName(null);
        setShowDocViewer(true);
      } else {
        setShowDocViewer(false);
      }
      
      setPromptContext('');
      await loadMessages(); // Sync with DB
      setUploadedFiles([]);
    } catch (error) {
      console.error('Error submitting prompt:', error);
      toast({ description: "Failed to process your request", variant: "destructive" });
      setPromptValue(userPrompt);
      setMessages(messages); // Revert optimistic update
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileClick = async (file: any) => {
    try {
      // Validate file object
      if (!file || !file.file_path) {
        toast({ description: "Invalid file", variant: "destructive" });
        return;
      }
      
      setSelectedDocId(null);
      setSelectedDocContent(null);
      setSelectedDocTitle(null);
      
      const publicUrl = file.publicUrl || supabase.storage
        .from('conversation-files')
        .getPublicUrl(file.file_path).data.publicUrl;
      
      setSelectedFileUrl(publicUrl);
      setSelectedFileName(file.file_name || 'Document');
      setShowDocViewer(true);
      setSourcesModalOpen(false);
    } catch (error) {
      console.error('Error loading file:', error);
      toast({ description: "Failed to load file", variant: "destructive" });
    }
  };

  const handleFileClickByName = async (fileName: string) => {
    const file = conversationFiles.find(f => f.file_name === fileName);
    if (file) {
      await handleFileClick(file);
    }
  };

  const handleReaction = async (messageId: string, reactionType: "like" | "dislike") => {
    if (!user) return;

    try {
      const { data: existingReaction } = await supabase
        .from('message_reactions')
        .select('*')
        .eq('message_id', messageId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingReaction) {
        if (existingReaction.reaction_type === reactionType) {
          await supabase
            .from('message_reactions')
            .delete()
            .eq('id', existingReaction.id);
        } else {
          await supabase
            .from('message_reactions')
            .update({ reaction_type: reactionType })
            .eq('id', existingReaction.id);
        }
      } else {
        await supabase
          .from('message_reactions')
          .insert({
            message_id: messageId,
            user_id: user.id,
            reaction_type: reactionType
          });
      }
      
      await loadMessages();
    } catch (error) {
      console.error('Error handling reaction:', error);
    }
  };

  const handleRegenerate = async (messageId: string) => {
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    const previousUserMessage = [...messages]
      .slice(0, messageIndex)
      .reverse()
      .find(m => m.role === 'user');

    if (!previousUserMessage || !user) {
      toast({ description: 'No previous user message found', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    
    try {
      // Step 1: Delete the current assistant message
      await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);

      // Step 2: Get user info for webhook
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      // Step 3: Get file URLs for this conversation
      const fileUrls = conversationFiles.map(f => {
        const publicUrl = supabase.storage.from('conversation-files').getPublicUrl(f.file_path).data.publicUrl;
        return {
          name: f.file_name,
          url: publicUrl
        };
      });

      // Step 4: Resend to n8n with complete payload
      const { data: functionData, error: functionError } = await supabase.functions.invoke('send-prompt', {
        body: { 
          conversationId,
          userId: user.id,
          userName: profile?.full_name || 'User',
          userEmail: user.email || '',
          mode,
          deepResearch,
          prompt: previousUserMessage.content,
          originalPrompt: previousUserMessage.content,
          fileUrls,
          timestamp: new Date().toISOString()
        }
      });

      if (functionError) throw functionError;

      // Step 5: Add new assistant response with document metadata
      const messageContent = functionData.docId && functionData.docContent 
        ? JSON.stringify({
            text: functionData.response || 'No response received',
            docId: functionData.docId,
            docContent: functionData.docContent,
            docTitle: functionData.docTitle || 'Generated Document'
          })
        : functionData.response || 'No response received';
        
      await addMessage(conversationId!, 'assistant', messageContent);
      
      // Step 6: Handle document if available with validation
      if (functionData.docId && functionData.docContent && typeof functionData.docContent === 'string' && functionData.docContent.trim() !== '') {
        let title = 'Generated Document';
        if (functionData.docTitle && typeof functionData.docTitle === 'string' && functionData.docTitle.trim() !== '') {
          // Normalize title
          title = functionData.docTitle.trim().replace(/^["'""'']|["'""'']$/g, '').replace(/,$/, '');
        }
          
        setSelectedDocId(functionData.docId);
        setSelectedDocContent(functionData.docContent);
        setSelectedDocTitle(title);
        setSelectedFileUrl(null);
        setSelectedFileName(null);
        setShowDocViewer(true);
      }
      
      await loadMessages();
      toast({ description: 'Response regenerated successfully' });
    } catch (error) {
      console.error('Error regenerating response:', error);
      toast({ description: 'Failed to regenerate response', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrivacyToggle = async () => {
    const newPrivacy = privacy === "private" ? "public" : "private";
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ privacy: newPrivacy })
        .eq('id', conversationId);

      if (error) throw error;
      setPrivacy(newPrivacy);
      toast({ description: `Conversation is now ${newPrivacy}` });
    } catch (error) {
      console.error('Error updating privacy:', error);
      toast({ description: "Failed to update privacy", variant: "destructive" });
    }
  };

  const handleTitleSave = async () => {
    if (!editedTitle.trim() || !conversationId) return;
    
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ title: editedTitle.trim() })
        .eq('id', conversationId);

      if (error) throw error;
      setIsEditingTitle(false);
      toast({ description: "Title updated successfully" });
    } catch (error) {
      console.error('Error updating title:', error);
      toast({ description: "Failed to update title", variant: "destructive" });
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      setEditedTitle(conversation?.title || '');
      setIsEditingTitle(false);
    }
  };

  const handleDocumentOpen = (docId: string, docContent: string, docTitle: string) => {
    // Toggle if clicking the same document that's already open
    if (showDocViewer && selectedDocId === docId) {
      setShowDocViewer(false);
      setSelectedDocId(null);
      setSelectedDocContent(null);
      setSelectedDocTitle(null);
    } else {
      setSelectedDocId(docId);
      setSelectedDocContent(docContent);
      setSelectedDocTitle(docTitle);
      setSelectedFileUrl(null);
      setSelectedFileName(null);
      setShowDocViewer(true);
    }
  };

  const getPrivacyIcon = () => {
    switch (privacy) {
      case "private":
        return <Lock className="h-4 w-4" />;
      case "shared":
        return <Users className="h-4 w-4" />;
      case "public":
        return <Globe className="h-4 w-4" />;
    }
  };

  return (
    <>
      <div className="min-h-screen flex w-full bg-background fade-in">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          {/* Conversation Header */}
          <div className="border-b border-border px-4 md:px-6 py-3 md:py-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full md:hidden shrink-0"
                  onClick={() => setOpen(true)}
                >
                  <Menu className="h-4 w-4" />
                </Button>
                {isEditingTitle ? (
                  <input
                    ref={titleInputRef}
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onBlur={handleTitleSave}
                    onKeyDown={handleTitleKeyDown}
                    className="text-xl md:text-2xl font-serif font-bold bg-transparent border-b-2 border-primary focus:outline-none flex-1 min-w-0"
                  />
                ) : (
                  <h1 
                    className="text-xl md:text-2xl font-serif font-bold cursor-pointer hover:text-primary transition-colors truncate flex-1 min-w-0"
                    onClick={() => setIsEditingTitle(true)}
                  >
                    {conversation?.title || "New Conversation"}
                  </h1>
                )}
              </div>
              <div className="flex items-center gap-1 md:gap-2 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={handlePrivacyToggle}
                >
                  {getPrivacyIcon()}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full h-8 hidden md:flex"
                  onClick={() => setShareModalOpen(true)}
                >
                  Share
                </Button>
                <Button
                  size="sm"
                  className="rounded-full h-8 hidden md:flex"
                  onClick={() => setExportModalOpen(true)}
                >
                  Export
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground overflow-x-auto">
              <FileText className="h-3 w-3 md:h-4 md:w-4 shrink-0" />
              <span 
                className="cursor-pointer hover:text-foreground transition-colors shrink-0"
                onClick={() => setSourcesModalOpen(true)}
              >
                {conversationFiles.length} sources
              </span>
              <span className="shrink-0">•</span>
              <Bot className="h-3 w-3 md:h-4 md:w-4 shrink-0" />
              <span className="shrink-0">assistant</span>
              <span className="shrink-0">•</span>
              <Calendar className="h-3 w-3 md:h-4 md:w-4 shrink-0" />
              <span className="shrink-0">Created {conversation?.created_at ? new Date(conversation.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</span>
            </div>
          </div>

          {/* Main Content Area - Fixed Layout */}
          <div className="flex-1 overflow-hidden flex relative">
            {/* Chat Area */}
            <div className={`flex flex-col overflow-hidden transition-all duration-300 ${
              showDocViewer ? 'md:mr-[50vw]' : 'w-full'
            }`}>
              {/* Scrollable messages area */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-4 md:p-6 pb-4">
                  <div className={`max-w-3xl space-y-6 ${showDocViewer ? '' : 'mx-auto'}`}>
                    {formatMessages(messages).map((message) => {
                      const parsedContent = parseMessageContent(message.content);
                      
                      // Look up document from database if docId exists
                      const dbDocument = parsedContent.docId ? conversationDocuments.get(parsedContent.docId) : null;
                      
                      return (
                        <MessageBubble 
                          key={message.id} 
                          message={{ ...message, content: parsedContent.text }}
                          showDocumentButton={false}
                          onDocumentClick={() => setShowDocViewer(!showDocViewer)}
                          onReaction={handleReaction}
                          onRegenerate={handleRegenerate}
                          onFileClick={handleFileClickByName}
                          onDocumentOpen={handleDocumentOpen}
                          docId={parsedContent.docId}
                          docContent={dbDocument?.doc_content || parsedContent.docContent}
                          docTitle={dbDocument?.doc_title || parsedContent.docTitle}
                          isDocumentOpen={showDocViewer && selectedDocId === parsedContent.docId}
                          onEditSave={async (messageId, newContent) => {
                          if (!user) return;
                          
                          setIsLoading(true);
                          try {
                            // Step 1: Find the edited message
                            const editedMessageIndex = messages.findIndex(m => m.id === messageId);
                            if (editedMessageIndex === -1) return;

                            // Step 2: Delete all subsequent messages (old assistant responses)
                            const messagesToDelete = messages.slice(editedMessageIndex + 1);
                            for (const msg of messagesToDelete) {
                              await supabase
                                .from('messages')
                                .delete()
                                .eq('id', msg.id);
                            }

                            // Step 3: Update the edited message in DB
                            await supabase
                              .from('messages')
                              .update({ content: newContent })
                              .eq('id', messageId);

                            // Step 4: Get user info
                            const { data: profile } = await supabase
                              .from('profiles')
                              .select('full_name')
                              .eq('id', user.id)
                              .single();

                            // Step 5: Get file URLs
                            const fileUrls = conversationFiles.map(f => {
                              const publicUrl = supabase.storage.from('conversation-files').getPublicUrl(f.file_path).data.publicUrl;
                              return {
                                name: f.file_name,
                                url: publicUrl
                              };
                            });

                            // Step 6: Resend to n8n
                            const { data, error } = await supabase.functions.invoke('send-prompt', {
                              body: {
                                conversationId,
                                userId: user.id,
                                userName: profile?.full_name || 'User',
                                userEmail: user.email || '',
                                mode,
                                deepResearch,
                                prompt: newContent,
                                originalPrompt: newContent,
                                context: promptContext || undefined,
                                fileUrls,
                                timestamp: new Date().toISOString()
                              }
                            });

                            if (error) throw error;

                            // Step 7: Add new assistant response
                            await addMessage(conversationId!, "assistant", data.response);
                            
                            // Step 8: Handle document if available
                            if (data.docId && data.docContent && data.docTitle &&
                                data.docContent.trim() !== '' && data.docTitle.trim() !== '') {
                              setSelectedDocId(data.docId);
                              setSelectedDocContent(data.docContent);
                              setSelectedDocTitle(data.docTitle);
                              setSelectedFileUrl(null);
                              setSelectedFileName(null);
                              setShowDocViewer(true);
                            }
                            
                            await loadMessages();
                          } catch (error) {
                            console.error('Error resending prompt:', error);
                            toast({ description: "Failed to resend prompt", variant: "destructive" });
                          } finally {
                            setIsLoading(false);
                          }
                        }}
                        />
                      );
                    })}
                    {isLoading && <MessageSkeleton showLoadingText={true} />}
                    <div ref={chatEndRef} />
                  </div>
                </div>
              </div>

              {/* Fixed PromptBox at bottom */}
              <div className="border-t border-border p-4 bg-background">
                <div className={`max-w-3xl ${showDocViewer ? '' : 'mx-auto'}`}>
                  <PromptBox
                    mode={mode}
                    onModeChange={(newMode) => setMode(newMode as "ask" | "draft")}
                    deepResearch={deepResearch}
                    onDeepResearchChange={setDeepResearch}
                    uploadedFiles={uploadedFiles}
                    onFileUpload={handleFileUpload}
                    onFileRemove={handleFileRemove}
                    value={promptValue}
                    onChange={setPromptValue}
                    onSubmit={handleSubmit}
                    isLoading={isLoading}
                    isUploading={isUploading}
                    disableModeChange={true}
                    context={promptContext}
                    onContextRemove={() => setPromptContext('')}
                  />
                </div>
              </div>
            </div>

            {/* Document Viewer - Fixed Right Side */}
            {showDocViewer && (
              <div className="fixed right-0 top-0 bottom-0 w-full md:w-[50vw] bg-background border-l border-border z-40 flex flex-col">
                <DocumentEditor
                  showDocViewer={showDocViewer}
                  onToggleViewer={() => setShowDocViewer(false)}
                  fileUrl={selectedFileUrl}
                  fileName={selectedFileName}
                  docId={selectedDocId}
                  docContent={selectedDocContent}
                  conversationId={conversationId}
                  userId={user?.id}
                  onContextSelect={handleContextSelect}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <ShareModal
        open={shareModalOpen}
        onOpenChange={setShareModalOpen}
        privacy={privacy}
        onPrivacyChange={setPrivacy}
        conversationId={conversationId || ""}
        publicShareToken={conversation?.public_share_token}
      />
      <ExportModal 
        open={exportModalOpen} 
        onOpenChange={setExportModalOpen}
        conversationTitle={conversation?.title}
        messages={messages.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: new Date(m.created_at).toLocaleString()
        }))}
        documentContent={selectedDocContent || undefined}
        documentTitle={selectedDocTitle || undefined}
      />
      <SourcesModal 
        open={sourcesModalOpen} 
        onOpenChange={setSourcesModalOpen}
        files={conversationFiles}
        onFileClick={handleFileClick}
      />
    </>
  );
};

const ConversationDetail = () => {
  return (
    <SidebarProvider>
      <ConversationDetailContent />
    </SidebarProvider>
  );
};

export default ConversationDetail;

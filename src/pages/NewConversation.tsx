import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { PromptBox } from "@/components/conversation/PromptBox";
import { FileUploadProgress } from "@/components/loading/FileUploadProgress";
import { MessageCircle, FileText, Database } from "lucide-react";
import { useConversation } from "@/hooks/useConversation";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const NewConversation = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { createConversation, uploadFile, addMessage } = useConversation(undefined, user);
  const [mode, setMode] = useState<"ask" | "draft">("ask");
  const [deepResearch, setDeepResearch] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [promptValue, setPromptValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);

  const examplePrompts = [
    { icon: MessageCircle, text: "Analyze this contract for potential risks" },
    { icon: FileText, text: "Draft a non-disclosure agreement" },
    { icon: Database, text: "Organize client information from documents" },
  ];

  const handleFileUpload = async (files: File[]) => {
    setIsUploading(true);
    try {
      const newFiles = files.map((file) => ({
        id: Math.random().toString(),
        name: file.name,
        file,
      }));
      setUploadedFiles([...uploadedFiles, ...newFiles]);
      
      // Start file processing timer
      if (newFiles.length > 0) {
        setIsProcessingFiles(true);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileRemove = (fileId: string) => {
    setUploadedFiles(uploadedFiles.filter((f) => f.id !== fileId));
  };

  const handleSubmit = async () => {
    if (!promptValue.trim() || !user) return;
    
    setIsLoading(true);
    try {
      const conversation = await createConversation();
      if (!conversation) {
        toast({ description: "Failed to create conversation", variant: "destructive" });
        return;
      }

      const userMessage = await addMessage(conversation.id, 'user', promptValue);
      if (!userMessage) {
        toast({ description: "Failed to send message", variant: "destructive" });
        return;
      }

      for (const fileItem of uploadedFiles) {
        await uploadFile(conversation.id, fileItem.file, userMessage.id);
      }

      const { data, error } = await supabase.functions.invoke('send-prompt', {
        body: {
          conversationId: conversation.id,
          userId: user.id,
          prompt: promptValue,
          mode,
          deepResearch
        }
      });

      if (error) throw error;

      const assistantMessage = await addMessage(conversation.id, 'assistant', data.response);

      const nameResponse = await supabase.functions.invoke('generate-conversation-name', {
        body: {
          prompt: promptValue,
          response: data.response
        }
      });

      if (nameResponse.data?.title) {
        await supabase
          .from('conversations')
          .update({ title: nameResponse.data.title })
          .eq('id', conversation.id);
      }

      navigate(`/conversation/${conversation.id}`);
    } catch (error) {
      console.error('Error submitting prompt:', error);
      toast({ description: "Failed to process your request", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background fade-in">
        <AppSidebar />
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-3xl">
            <div className="text-center mb-12">
              <h1 className="text-5xl font-serif font-bold mb-4">
                How can I help you today?
              </h1>
              <p className="text-lg text-muted-foreground">
                Choose a mode and start working with your legal documents
              </p>
            </div>

            {isProcessingFiles && uploadedFiles.length > 0 && (
              <div className="mb-6">
                <FileUploadProgress 
                  fileCount={uploadedFiles.length} 
                  onComplete={() => setIsProcessingFiles(false)}
                />
              </div>
            )}

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
              isProcessingFiles={isProcessingFiles}
              className="mb-8"
            />

            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Try these examples:</p>
              {examplePrompts.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => setPromptValue(prompt.text)}
                  className="w-full text-left p-4 rounded-full border border-border hover:bg-accent transition-colors flex items-center gap-3"
                >
                  <prompt.icon className="h-5 w-5 text-muted-foreground" />
                  <span>{prompt.text}</span>
                </button>
              ))}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default NewConversation;

import { useState } from "react";
import { Copy, RotateCcw, ThumbsUp, ThumbsDown, Edit2, CornerUpLeft, User, Bot, Check, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DocumentVersionButton } from "@/components/document/DocumentVersionButton";
import { DocumentAttachment } from "@/components/conversation/DocumentAttachment";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  conversation_id?: string;
  files?: string[];
  versions?: { content: string; timestamp: string }[];
  reactions?: { likes: number; dislikes: number; userReaction?: "like" | "dislike" };
  context?: string;
  contextDocId?: string;
}

interface MessageBubbleProps {
  message: Message;
  showDocumentButton?: boolean;
  onDocumentClick?: () => void;
  onEditSave?: (messageId: string, newContent: string) => Promise<void>;
  onReaction?: (messageId: string, reactionType: "like" | "dislike") => void;
  onRegenerate?: (messageId: string) => void;
  onFileClick?: (fileName: string) => void;
  onDocumentOpen?: (docId: string, docContent: string, docTitle: string) => void;
  docId?: string | null;
  docContent?: string | null;
  docTitle?: string | null;
  isDocumentOpen?: boolean;
}

export function MessageBubble({ 
  message, 
  showDocumentButton = false, 
  onDocumentClick, 
  onEditSave, 
  onReaction, 
  onRegenerate, 
  onFileClick,
  onDocumentOpen,
  docId,
  docContent,
  docTitle,
  isDocumentOpen = false
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState("current");

  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = () => {
    if (onRegenerate) {
      onRegenerate(message.id);
    }
  };

  const handleReaction = (type: "like" | "dislike") => {
    if (onReaction) {
      onReaction(message.id, type);
      
      // Send feedback to backend
      supabase.functions.invoke('send-feedback', {
        body: {
          conversationId: message.conversation_id || '',
          messageId: message.id,
          userId: '', // Will be set by edge function from JWT
          reaction: type
        }
      }).catch(err => console.error('Error sending feedback:', err));
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (onEditSave && editedContent !== message.content) {
      await onEditSave(message.id, editedContent);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedContent(message.content);
    setIsEditing(false);
  };

  const handleRevert = () => {
    console.log("Reverting to previous version for message:", message.id);
  };

  const formatContent = (content: string) => {
    // Convert **text** to bold HTML
    const parts = content.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const displayContent = message.content;
  const isUser = message.role === "user";

  return (
    <div className="flex gap-3 items-start">
      {/* Avatar */}
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className={isUser ? "bg-primary text-primary-foreground" : "bg-primary-foreground"}>
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>

      {/* Message Content */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full p-3 text-sm border rounded-lg bg-background min-h-[100px] focus:outline-none focus:border-[#cbcbcb]"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveEdit} className="rounded-full h-7">
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancelEdit} className="rounded-full h-7">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Context Badge for User Messages */}
            {isUser && message.context && (
              <div className="context-badge mb-2">
                <span className="text-xs">
                  {message.context.length > 100 
                    ? `${message.context.substring(0, 100)}...` 
                    : message.context}
                </span>
              </div>
            )}
            
            {/* Message Text */}
            <div className="text-sm whitespace-pre-wrap text-foreground">{formatContent(displayContent)}</div>

            {/* File Attachments for User Messages */}
            {isUser && message.files && message.files.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {message.files.slice(0, 3).map((fileName, index) => (
                  <div
                    key={index}
                    onClick={() => onFileClick?.(fileName)}
                    className="flex items-center gap-1.5 bg-accent rounded-full px-2.5 py-1 text-xs cursor-pointer hover:bg-accent/80 transition-colors"
                  >
                    <FileText className="h-3 w-3 text-muted-foreground" />
                    <span className="truncate max-w-[120px]">{fileName}</span>
                  </div>
                ))}
                {message.files.length > 3 && (
                  <div className="flex items-center gap-1.5 bg-accent rounded-full px-2.5 py-1 text-xs text-muted-foreground">
                    +{message.files.length - 3} more
                  </div>
                )}
              </div>
            )}

            {/* Timestamp */}
            <p className="text-xs text-muted-foreground mt-2">{message.timestamp}</p>

            {/* Document Version Button - Before Action Icons */}
            {showDocumentButton && onDocumentClick && (
              <div className="mt-4">
                <DocumentVersionButton
                  fileName={docTitle || 'Generated Document'}
                  lastUpdate="Updated recently"
                  versionCount={1}
                  onClick={onDocumentClick}
                  isVisible={true}
                />
              </div>
            )}

            {/* Document Reference - Clickable card to open/close document */}
            {!isUser && docId && docContent && (
              <div 
                onClick={() => onDocumentOpen?.(docId, docContent, docTitle || 'Generated Document')}
                className={`mt-3 flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors border ${
                  isDocumentOpen 
                    ? 'bg-primary/10 border-primary hover:bg-primary/15' 
                    : 'bg-accent/50 hover:bg-accent border-border'
                }`}
              >
                <FileText className={`h-4 w-4 ${isDocumentOpen ? 'text-primary' : 'text-primary'}`} />
                <div className="flex-1">
                  <p className="text-sm font-medium">{docTitle || 'Generated Document'}</p>
                  <p className="text-xs text-muted-foreground">
                    {isDocumentOpen ? 'Click to close editor' : 'Click to view in editor'}
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 mt-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-full"
            onClick={handleCopy}
            title="Copy"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </Button>

          {!isUser && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full"
                onClick={handleRegenerate}
                title="Regenerate"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full"
                onClick={() => handleReaction("like")}
                title="Like"
              >
                <ThumbsUp className={`h-3 w-3 ${message.reactions?.userReaction === "like" ? "fill-current" : ""}`} />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full"
                onClick={() => handleReaction("dislike")}
                title="Dislike"
              >
                <ThumbsDown className={`h-3 w-3 ${message.reactions?.userReaction === "dislike" ? "fill-current" : ""}`} />
              </Button>
            </>
          )}

          {isUser && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full"
                onClick={handleEdit}
                title="Edit"
              >
                <Edit2 className="h-3 w-3" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full"
                onClick={handleRevert}
                title="Revert"
              >
                <CornerUpLeft className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>

        {/* Version Selector */}
        {message.versions && message.versions.length > 0 && (
          <div className="mt-2">
            <Select value={selectedVersion} onValueChange={setSelectedVersion}>
              <SelectTrigger className="w-32 h-7 rounded-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Current</SelectItem>
                {message.versions.map((version, index) => (
                  <SelectItem key={index} value={`v${index + 1}`}>
                    Version {index + 1}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}

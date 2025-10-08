import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Sparkles, ArrowUp, FileText, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileAttachment {
  id: string;
  name: string;
  file: File;
  progress?: number;
}

interface PromptBoxProps {
  mode: "ask" | "draft";
  onModeChange: (mode: string) => void;
  deepResearch: boolean;
  onDeepResearchChange: (enabled: boolean) => void;
  uploadedFiles: FileAttachment[];
  onFileUpload: (files: File[]) => void;
  onFileRemove: (fileId: string) => void;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  isUploading?: boolean;
  uploadProgress?: { [key: string]: number };
  className?: string;
  disableModeChange?: boolean;
  isProcessingFiles?: boolean;
  context?: string;
  onContextRemove?: () => void;
}

export function PromptBox({
  mode,
  onModeChange,
  deepResearch,
  onDeepResearchChange,
  uploadedFiles,
  onFileUpload,
  onFileRemove,
  value,
  onChange,
  onSubmit,
  isLoading,
  isUploading = false,
  uploadProgress = {},
  className,
  disableModeChange = false,
  isProcessingFiles = false,
  context,
  onContextRemove,
}: PromptBoxProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onFileUpload(Array.from(e.target.files));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !isLoading) {
        onSubmit();
      }
    }
  };

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const handleAIEnhance = async () => {
    setLoadingSuggestions(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "generate-prompt-inspiration"
      );

      if (error) throw error;

      if (data?.suggestions && Array.isArray(data.suggestions)) {
      const cleanedSuggestions = data.suggestions.map((s: string) =>
        s
          .trim()
          .replace(/^[“”"']+|[“”"']+$/g, '')
          .replace(/[.,;]+$/g, '')
      );

      setSuggestions(cleanedSuggestions);
      setShowSuggestions(true);
    }

    } catch (error) {
      console.error("Error generating suggestions:", error);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    // Auto-resize textarea
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
  };

  return (
    <div
      className={cn(
        "flex flex-col rounded-[28px] p-2 shadow-sm border bg-primary",
        className
      )}
    >
      {/* Context Chip */}
      {context && (
        <div className="flex gap-2 mb-2 px-2">
          <div className="flex items-center gap-1.5 bg-accent rounded-full px-3 py-1.5 text-sm">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs text-primary truncate max-w-60">
              {context.substring(0, 30)}...
            </span>
            {onContextRemove && (
              <button
                onClick={onContextRemove}
                className="hover:bg-background rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* File Upload Area */}
      {uploadedFiles.length > 0 && (
        <div className="flex gap-2 mb-2 px-2 flex-wrap">
          {uploadedFiles.map((file) => {
            const progress = uploadProgress[file.id];
            const isFileUploading = progress !== undefined && progress < 100;

            return (
              <div
                key={file.id}
                className="flex items-center gap-1.5 bg-accent rounded-full px-3 py-1.5 text-sm relative"
              >
                {isFileUploading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    <span className="text-xs truncate max-w-32">
                      {file.name} ({progress}%)
                    </span>
                  </>
                ) : (
                  <>
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs truncate max-w-32">
                      {file.name}
                    </span>
                    <button
                      onClick={() => onFileRemove(file.id)}
                      className="hover:bg-background rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Upload progress indicator */}
      {isUploading && (
        <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-accent/50 rounded-lg">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">
            Uploading files...
          </span>
        </div>
      )}

      {/* Main Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={
          mode === "ask"
            ? "Ask your legal question..."
            : "What would you like to draft?"
        }
        className="w-full resize-none border-0 bg-transparent p-3 mb-8 text-input focus:outline-none focus:ring-0 min-h-12 max-h-[200px] overflow-y-auto rounded-2xl"
        rows={1}
        disabled={isProcessingFiles}
      />

      {/* Bottom Controls */}
      <div className="flex items-center justify-between gap-2 mt-0.5 p-1">
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.txt,.csv,.xlsx,.xls,.doc,.docx"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full text-primary-foreground hover:text-primary hover:bg-accent"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessingFiles}
          >
            <Plus className="h-4 w-4" />
          </Button>

          {/* Mode Selector */}
          {!disableModeChange && (
            <Select value={mode} onValueChange={onModeChange}>
              <SelectTrigger className="w-32 h-7 rounded-full text-xs border-0 text-primary bg-primary-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-accent">
                <SelectItem value="ask">Ask</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
          )}

          {/* Deep Research Toggle */}
          <div className="flex items-center gap-1.5">
            <Switch
              checked={deepResearch}
              onCheckedChange={onDeepResearchChange}
              className="scale-75"
            />
            <span className="text-xs text-input">Deep Research</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Popover open={showSuggestions} onOpenChange={setShowSuggestions}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full text-primary-foreground hover:bg-accent"
                onClick={handleAIEnhance}
                disabled={loadingSuggestions}
              >
                {loadingSuggestions ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-3" align="end" side="top">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground mb-1 ml-2 mt-2">
                  Suggested prompts:
                </p>
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      onChange(suggestion);
                      setShowSuggestions(false);
                    }}
                    className="w-full text-left px-4 py-3 rounded-full border border-muted hover:bg-accent transition-colors text-xs text-primary"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Button
            size="icon"
            className="h-7 w-7 rounded-full bg-primary-foreground text-primary"
            style={{ backgroundColor: "#e4fe7b" }}
            onClick={onSubmit}
            disabled={!value.trim() || isLoading || isProcessingFiles}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

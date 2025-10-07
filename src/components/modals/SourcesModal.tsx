import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

interface ConversationFile {
  id: string;
  file_name: string;
  file_path: string;
  file_type?: string | null;
  file_size?: number | null;
  created_at: string;
  publicUrl?: string;
}

interface SourcesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: ConversationFile[];
  onFileClick?: (file: ConversationFile & { publicUrl: string }) => void;
}

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return "Unknown size";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
};

export function SourcesModal({ open, onOpenChange, files, onFileClick }: SourcesModalProps) {
  const handleFileClick = (file: ConversationFile) => {
    const { data: { publicUrl } } = supabase.storage
      .from('conversation-files')
      .getPublicUrl(file.file_path);
    
    onFileClick?.({ ...file, publicUrl });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Sources</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-4">
          {files.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">No files uploaded yet</p>
            </div>
          ) : (
            files.map((file) => (
              <div
                key={file.id}
                onClick={() => handleFileClick(file)}
                className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent transition-colors cursor-pointer"
              >
                <div className="p-2 rounded-lg bg-muted">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{file.file_name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <span>{formatDistanceToNow(new Date(file.created_at), { addSuffix: true })}</span>
                    <span>•</span>
                    <span>{formatFileSize(file.file_size)}</span>
                    {file.file_type && (
                      <>
                        <span>•</span>
                        <span>{file.file_type}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

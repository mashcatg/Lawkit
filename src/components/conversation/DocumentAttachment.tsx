import { FileText, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

interface DocumentAttachmentProps {
  fileName: string;
  docId: string;
  timestamp: Date;
  onClick: () => void;
}

export function DocumentAttachment({
  fileName,
  docId,
  timestamp,
  onClick,
}: DocumentAttachmentProps) {
  return (
    <Button
      variant="outline"
      className="w-full justify-start h-auto py-3 px-4 mt-3 hover:bg-accent transition-colors"
      onClick={onClick}
    >
      <div className="flex items-start gap-3 w-full">
        <div className="rounded-lg bg-primary/10 p-2 shrink-0">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="font-medium text-sm truncate">{fileName}</div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            <Clock className="h-3 w-3" />
            <span>Updated {formatDistanceToNow(timestamp, { addSuffix: true })}</span>
            <span>•</span>
            <span className="font-medium text-primary">Lawkit AI</span>
          </div>
        </div>
      </div>
    </Button>
  );
}

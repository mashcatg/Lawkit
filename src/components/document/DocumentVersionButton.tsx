import { FileText, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DocumentVersionButtonProps {
  fileName: string;
  lastUpdate: string;
  versionCount: number;
  onClick: () => void;
  isVisible: boolean;
}

export function DocumentVersionButton({
  fileName,
  lastUpdate,
  versionCount,
  onClick,
  isVisible,
}: DocumentVersionButtonProps) {
  if (!isVisible) return null;

  return (
    <Button
      variant="outline"
      className="w-full rounded-2xl h-auto py-3 px-4 justify-start"
      onClick={onClick}
      style={{ backgroundColor: '#f4f4f5' }}
    >
      <div className="flex items-center gap-3 w-full">
        <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
        <div className="flex-1 text-left min-w-0">
          <p className="font-medium text-sm truncate">{fileName}</p>
          <div className="text-xs text-muted-foreground mt-0.5">
            {lastUpdate} <span className="mx-1">•</span> {versionCount} {versionCount === 1 ? 'version' : 'versions'}
          </div>
        </div>
      </div>
    </Button>
  );
}

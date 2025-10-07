import { Progress } from "@/components/ui/progress";
import { useEffect, useState } from "react";

interface FileUploadProgressProps {
  fileCount: number;
  onComplete: () => void;
}

const messages = [
  "Reading your files...",
  "Organizing content...",
  "Analyzing documents...",
  "Understanding context...",
  "Sorting information...",
];

export function FileUploadProgress({ fileCount, onComplete }: FileUploadProgressProps) {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const totalDuration = fileCount * 8 * 1000; // 8 seconds per file in milliseconds

  useEffect(() => {
    const startTime = Date.now();
    
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / totalDuration) * 100, 100);
      setProgress(newProgress);
      
      if (newProgress >= 100) {
        clearInterval(progressInterval);
        onComplete();
      }
    }, 100);

    const messageInterval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % messages.length);
    }, 3000);

    return () => {
      clearInterval(progressInterval);
      clearInterval(messageInterval);
    };
  }, [fileCount, totalDuration, onComplete]);

  return (
    <div className="space-y-3 p-4 border border-border rounded-lg bg-muted/50">
      <div className="relative overflow-hidden">
        <div className="text-sm font-medium text-foreground animate-shimmer bg-gradient-to-r from-foreground via-primary to-foreground bg-[length:200%_100%] bg-clip-text text-transparent">
          {messages[messageIndex]}
        </div>
      </div>
      <div className="space-y-2">
        <Progress value={progress} className="h-2" />
        <div className="text-xs text-muted-foreground text-right">
          {Math.round(progress)}%
        </div>
      </div>
    </div>
  );
}

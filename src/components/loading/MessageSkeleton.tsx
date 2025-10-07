import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot } from "lucide-react";
import { useLoadingMessages } from "@/hooks/useLoadingMessages";

interface MessageSkeletonProps {
  showLoadingText?: boolean;
  duration?: number;
}

export function MessageSkeleton({ showLoadingText = false, duration = 0 }: MessageSkeletonProps) {
  const loadingMessage = useLoadingMessages(duration);

  if (showLoadingText) {
    return (
      <div className="flex items-start gap-3">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-muted">
            <Bot className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="relative overflow-hidden inline-block">
            <div className="text-sm font-medium animate-shimmer bg-gradient-to-r from-foreground via-primary to-foreground bg-[length:200%_100%] bg-clip-text text-transparent">
              {loadingMessage}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

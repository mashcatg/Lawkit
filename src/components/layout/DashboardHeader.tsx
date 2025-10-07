import { Bell, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function DashboardHeader() {
  return (
    <header className="border-b border-border bg-background">
      <div className="flex items-center justify-end px-6 py-3 gap-2">
        <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
          <Bell className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
          <Settings className="h-4 w-4" />
        </Button>
        <Avatar className="h-9 w-9">
          <AvatarImage src="" />
          <AvatarFallback>JD</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}

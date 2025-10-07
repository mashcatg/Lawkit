import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  privacy: "private" | "shared" | "public";
  onPrivacyChange: (privacy: "private" | "shared" | "public") => void;
  conversationId: string;
  publicShareToken?: string;
}

export function ShareModal({ open, onOpenChange, privacy, onPrivacyChange, conversationId, publicShareToken }: ShareModalProps) {
  const [emails, setEmails] = useState("");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleCopyLink = () => {
    if (!publicShareToken) return;
    const shareLink = `${window.location.origin}/shared/${publicShareToken}`;
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveChanges = async () => {
    try {
      setSaving(true);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Parse emails
      const emailList = privacy === "shared" && emails ? 
        emails.split(',').map(e => e.trim()).filter(Boolean) : 
        [];

      // Get conversation title
      const { data: conversation } = await supabase
        .from("conversations")
        .select("title, public_share_token")
        .eq("id", conversationId)
        .single();

      // Update conversation in database
      const { error } = await supabase
        .from("conversations")
        .update({
          privacy: privacy,
          shared_with: emailList,
        })
        .eq("id", conversationId);

      if (error) throw error;

      // Send email notifications if sharing with specific people
      if (privacy === "shared" && emailList.length > 0) {
        try {
          await supabase.functions.invoke("send-share-notification", {
            body: {
              conversationId,
              conversationTitle: conversation?.title || "Untitled Conversation",
              emails: emailList,
              sharedByEmail: user.email,
              publicShareToken: conversation?.public_share_token,
            },
          });
        } catch (emailError) {
          console.error("Failed to send email notifications:", emailError);
          // Don't fail the whole operation if emails fail
        }
      }

      onPrivacyChange(privacy);
      
      toast({ 
        description: privacy === "shared" 
          ? "Conversation shared and email notifications sent"
          : "Sharing settings updated successfully",
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Error updating sharing settings:", error);
      toast({ 
        description: "Failed to update sharing settings", 
        variant: "destructive" 
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Share Conversation</DialogTitle>
          <DialogDescription>
            Control who can access this conversation and their permissions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <RadioGroup value={privacy} onValueChange={(value: any) => onPrivacyChange(value)}>
            <div className="space-y-4">
              {/* Private */}
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="private" id="private" className="mt-1" />
                <Label htmlFor="private" className="cursor-pointer flex-1">
                  <div className="font-medium">Only me</div>
                  <div className="text-sm text-muted-foreground">
                    This conversation is private and only visible to you
                  </div>
                </Label>
              </div>

              {/* Specific People */}
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="shared" id="shared" className="mt-1" />
                <Label htmlFor="shared" className="cursor-pointer flex-1">
                  <div className="font-medium">Specific people</div>
                  <div className="text-sm text-muted-foreground mb-2">
                    Share with specific email addresses
                  </div>
                  {privacy === "shared" && (
                    <Input
                      placeholder="Enter email addresses, separated by commas"
                      value={emails}
                      onChange={(e) => setEmails(e.target.value)}
                      className="mt-2"
                    />
                  )}
                </Label>
              </div>

              {/* Public Link */}
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="public" id="public" className="mt-1" />
                <Label htmlFor="public" className="cursor-pointer flex-1">
                  <div className="font-medium">Public link</div>
                  <div className="text-sm text-muted-foreground mb-2">
                    Anyone with the link can view this conversation
                  </div>
                  {privacy === "public" && publicShareToken && (
                    <div className="flex gap-2 mt-2">
                      <Input value={`${window.location.origin}/shared/${publicShareToken}`} readOnly className="flex-1" />
                      <Button
                        size="icon"
                        variant="outline"
                        className="rounded-full"
                        onClick={handleCopyLink}
                      >
                        {copied ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  )}
                </Label>
              </div>
            </div>
          </RadioGroup>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full" disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSaveChanges} className="rounded-full" disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

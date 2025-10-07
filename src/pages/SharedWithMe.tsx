import { useState, useEffect } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { FileText, Lock, Users, Globe, Calendar, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";

interface SharedConversation {
  id: string;
  title: string;
  privacy: string;
  updated_at: string;
  created_at: string;
  user_id: string;
  isRead: boolean;
}

export default function SharedWithMe() {
  const [conversations, setConversations] = useState<SharedConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const loadSharedConversations = async () => {
      if (!user?.email) return;
      
      try {
        const { data, error } = await supabase
          .from("conversations")
          .select("*")
          .contains("shared_with", [user.email])
          .order("updated_at", { ascending: false });

        if (error) throw error;

        // Check which conversations have been viewed
        const conversationsWithReadStatus = await Promise.all(
          (data || []).map(async (conv) => {
            const { data: viewData } = await supabase
              .from("conversation_views")
              .select("last_viewed_at")
              .eq("conversation_id", conv.id)
              .eq("user_email", user.email)
              .single();

            const isRead = viewData ? 
              new Date(viewData.last_viewed_at) > new Date(conv.updated_at) : 
              false;

            return { ...conv, isRead };
          })
        );

        setConversations(conversationsWithReadStatus);
      } catch (error) {
        console.error("Error loading shared conversations:", error);
      } finally {
        setLoading(false);
      }
    };

    loadSharedConversations();
  }, [user]);

  const getPrivacyIcon = (privacy: string) => {
    switch (privacy) {
      case "private":
        return <Lock className="h-4 w-4" />;
      case "team":
        return <Users className="h-4 w-4" />;
      case "public":
        return <Globe className="h-4 w-4" />;
      default:
        return <Lock className="h-4 w-4" />;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full fade-in">
        <AppSidebar />
        <main className="flex-1 p-4 md:p-8 overflow-auto">
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="space-y-2">
              <h1 className="text-3xl md:text-4xl font-bold font-serif">Shared With Me</h1>
              <p className="text-muted-foreground">Conversations others have shared with you</p>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {conversations.map((conversation) => (
                    <Card
                      key={conversation.id}
                      className="transition-all cursor-pointer border-border hover:border-primary/20"
                      onClick={() => navigate(`/conversation/${conversation.id}`)}
                    >
                      <CardContent className="p-4 md:p-6">
                        <div className="flex items-start gap-4">
                          <Avatar className="h-10 w-10 shrink-0">
                            <AvatarFallback className="bg-primary text-primary-foreground">
                              SC
                            </AvatarFallback>
                          </Avatar>
                          
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-base truncate">
                                    {conversation.title}
                                  </h3>
                                  {!conversation.isRead && (
                                    <Badge variant="default" className="shrink-0">New</Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                  Shared conversation
                                </p>
                              </div>
                              
                              <div className="flex items-center gap-2 text-muted-foreground shrink-0">
                                {getPrivacyIcon(conversation.privacy)}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDistanceToNow(new Date(conversation.created_at), { addSuffix: true })}
                              </span>
                              <span className="flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                Updated {formatDistanceToNow(new Date(conversation.updated_at), { addSuffix: true })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {conversations.length === 0 && (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No shared conversations yet</p>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

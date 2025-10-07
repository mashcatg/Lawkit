import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Search, MessageSquare, Users, FileText, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";

interface SearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

export function SearchModal({ open, onOpenChange }: SearchModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [myChats, setMyChats] = useState<Conversation[]>([]);
  const [sharedChats, setSharedChats] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && user) {
      loadConversations();
    }
  }, [open, user]);

  const loadConversations = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Load user's own conversations
      const { data: myData, error: myError } = await supabase
        .from("conversations")
        .select("id, title, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(20);

      if (myError) throw myError;
      setMyChats(myData || []);

      // Load shared conversations
      if (user.email) {
        const { data: sharedData, error: sharedError } = await supabase
          .from("conversations")
          .select("id, title, updated_at")
          .contains("shared_with", [user.email])
          .order("updated_at", { ascending: false })
          .limit(20);

        if (sharedError) throw sharedError;
        setSharedChats(sharedData || []);
      }
    } catch (error) {
      console.error("Error loading conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  const templates = [
    { id: "t1", title: "Non-Disclosure Agreement", category: "Contracts" },
    { id: "t2", title: "Employment Contract", category: "HR" },
    { id: "t3", title: "Service Agreement", category: "Contracts" },
  ];

  const handleChatClick = (id: string) => {
    navigate(`/conversation/${id}`);
    onOpenChange(false);
  };

  const filteredMyChats = myChats.filter((chat) => chat.title.toLowerCase().includes(searchQuery.toLowerCase()));

  const filteredSharedChats = sharedChats.filter((chat) =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredTemplates = templates.filter(
    (template) =>
      template.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.category.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Search</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations and templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-[#edebbe]"
          />
        </div>

        <Tabs defaultValue="my-chats" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="my-chats">My Chats</TabsTrigger>
            <TabsTrigger value="shared">Shared to Me</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="my-chats" className="flex-1 overflow-y-auto mt-4">
            {loading ? (
              <div className="text-center text-muted-foreground py-8">Loading...</div>
            ) : filteredMyChats.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">No conversations found</div>
            ) : (
              <div className="space-y-2">
                {filteredMyChats.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => handleChatClick(chat.id)}
                    className="w-full text-left p-3 rounded-lg hover:bg-accent transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{chat.title}</div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <Clock className="h-3 w-3" />
                          <span>{new Date(chat.updated_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="shared" className="flex-1 overflow-y-auto mt-4">
            {loading ? (
              <div className="text-center text-muted-foreground py-8">Loading...</div>
            ) : filteredSharedChats.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">No shared conversations found</div>
            ) : (
              <div className="space-y-2">
                {filteredSharedChats.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => handleChatClick(chat.id)}
                    className="w-full text-left p-3 rounded-lg hover:bg-accent transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{chat.title}</div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <Clock className="h-3 w-3" />
                          <span>{new Date(chat.updated_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="templates" className="flex-1 overflow-y-auto mt-4">
            {filteredTemplates.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">No templates found</div>
            ) : (
              <div className="space-y-2">
                {filteredTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => {
                      navigate("/templates");
                      onOpenChange(false);
                    }}
                    className="w-full text-left p-3 rounded-lg hover:bg-accent transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{template.title}</div>
                        <div className="text-sm text-muted-foreground mt-1">{template.category}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect, memo } from "react";
import { useNavigate, useLocation, NavLink } from "react-router-dom";
import { Home, FileText, Users, User, Plus, Search, PanelRightClose, MoreVertical, Trash2, ExternalLink } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { SearchModal } from "@/components/modals/SearchModal";
import { DeleteConfirmModal } from "@/components/modals/DeleteConfirmModal";
import { formatDistanceToNow } from "date-fns";

interface NavItem {
  title: string;
  icon: any;
  url: string;
}

const navItems: NavItem[] = [
  { title: "Home", icon: Home, url: "/dashboard" },
  { title: "Templates", icon: FileText, url: "/templates" },
  { title: "Shared with me", icon: Users, url: "/shared" },
  { title: "Profile", icon: User, url: "/profile" },
];

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
  last_message?: string;
}

const ConversationItem = memo(({ conversation, onDelete }: { conversation: Conversation; onDelete: () => void }) => {
  const navigate = useNavigate();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const location = useLocation();
  const isActive = location.pathname === `/conversation/${conversation.id}`;

  const timeAgo = formatDistanceToNow(new Date(conversation.updated_at), { addSuffix: true });

  return (
    <SidebarMenuItem>
      <div className={`group relative flex items-center gap-2 ${isActive ? 'bg-primary-foreground text-primary' : ''} hover:bg-primary-foreground hover:text-primary rounded-md transition-colors`}>
        <SidebarMenuButton
          onClick={() => navigate(`/conversation/${conversation.id}`)}
          className="flex-1 justify-start h-auto py-3 px-3"
          isActive={isActive}
        >
          <FileText className={`${isCollapsed ? '' : 'mr-3'} h-4 w-4 flex-shrink-0`} />
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate text-sm">{conversation.title}</div>
              {conversation.last_message && (
                <div className="text-xs text-muted-foreground truncate">
                  {conversation.last_message}
                </div>
              )}
              <div className="text-xs text-muted-foreground mt-0.5">{timeAgo}</div>
            </div>
          )}
        </SidebarMenuButton>
        {!isCollapsed && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity outline-none mr-1 hover:bg-muted hover:text-primary"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/conversation/${conversation.id}`)}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Open
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </SidebarMenuItem>
  );
});

ConversationItem.displayName = "ConversationItem";

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadConversations();
      
      const channel = supabase
        .channel('sidebar-conversations')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'conversations',
            filter: `user_id=eq.${user.id}`
          },
          () => {
            loadConversations();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const loadConversations = async () => {
    if (!user) return;

    try {
      const { data: convos, error: convosError } = await supabase
        .from('conversations')
        .select('id, title, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(10);

      if (convosError) throw convosError;

      const conversationsWithMessages = await Promise.all(
        (convos || []).map(async (convo) => {
          const { data: lastMsg } = await supabase
            .from('messages')
            .select('content')
            .eq('conversation_id', convo.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            ...convo,
            last_message: lastMsg?.content?.substring(0, 50) || undefined
          };
        })
      );

      setConversations(conversationsWithMessages);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const handleDeleteClick = (conversationId: string) => {
    setConversationToDelete(conversationId);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!conversationToDelete) return;

    try {
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationToDelete);

      if (error) throw error;

      toast({ description: "Conversation deleted successfully" });
      
      if (location.pathname === `/conversation/${conversationToDelete}`) {
        navigate('/dashboard');
      }
      
      await loadConversations();
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast({ description: "Failed to delete conversation", variant: "destructive" });
    } finally {
      setDeleteModalOpen(false);
      setConversationToDelete(null);
    }
  };

  return (
    <>
      <Sidebar collapsible="icon" className="border-r">
        <SidebarHeader>
          <div className={`flex items-center ${isCollapsed ? "flex-col" : ""} justify-between p-2`}>
            <div className={`flex items-center gap-2 `}>
              {!isCollapsed ? (
              <img 
                src="/logo.png" 
                alt="Lawkit" 
                className={`h-8 mr-2 object-contain`}
              />
              ) : (
                <img 
                src="/lawkit-favicon.png" 
                alt="Lawkit" 
                className={`h-8 mr-2 object-contain`}
              />
              )}
              {/* {!isCollapsed && (
                <span className="font-semibold text-lg">Lawkit</span>
              )} */}
            </div>
            <div className={`flex items-center gap-1 ${isCollapsed ? "flex-col-reverse" : ""}`}>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSearchOpen(true)}
                className="h-8 w-8"
              >
                <Search className="h-4 w-4" />
              </Button>
                <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="h-8 w-8"
                >
                <PanelRightClose 
                  className="h-4 w-4" 
                  style={{ transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}
                />
                </Button>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={location.pathname === item.url} className="hover:bg-sidebar-accent hover:text-primary transition-colors active:bg-sidebar-accent active:text-primary data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-primary">
                        <NavLink to={item.url} className="flex items-center gap-3">
                          <Icon className="h-4 w-4" />
                          {!isCollapsed && <span>{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

         

          <SidebarGroup>
            <SidebarGroupContent>
              <Button
                onClick={() => navigate('/conversation/new')}
                className={`w-full justify-start gap-3 text-primary bg-primary-foreground hover:bg-primary/90 text-center hover:bg-sidebar-accent ${isCollapsed ? 'px-[8px] py-[0px] h-8' : ''}`}
                variant="default"
              >
                <Plus className="h-4 w-4" />
                {!isCollapsed && <span>New Conversation</span>}
              </Button>
            </SidebarGroupContent>
          </SidebarGroup>

    

          <SidebarGroup>
            <SidebarGroupLabel>Recent Conversations</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {conversations.map((conversation) => (
                  <ConversationItem
                    key={conversation.id}
                    conversation={conversation}
                    onDelete={() => handleDeleteClick(conversation.id)}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <SearchModal open={searchOpen} onOpenChange={setSearchOpen} />
      <DeleteConfirmModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        onConfirm={handleDeleteConfirm}
        title="Delete Conversation"
        description="Are you sure you want to delete this conversation? This action cannot be undone."
      />
    </>
  );
}

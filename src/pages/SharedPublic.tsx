import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export default function SharedPublic() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      // Store the token in sessionStorage and redirect to login
      sessionStorage.setItem("shared_redirect_token", token || "");
      navigate(`/login?redirect=/shared/${token}`);
    } else {
      // User is logged in, redirect to conversation detail with token
      // The conversation detail will handle loading by public_share_token
      navigate(`/conversation/shared/${token}`);
    }
  }, [user, loading, token, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading shared conversation...</p>
      </div>
    </div>
  );
}

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, resetPassword, user } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);

  useEffect(() => {
    if (user) {
      const redirect = searchParams.get("redirect");
      navigate(redirect || "/dashboard");
    }
  }, [user, navigate, searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      toast({
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
    } else {
      toast({
        description: "Logged in successfully",
      });
      const redirect = searchParams.get("redirect");
      navigate(redirect || "/dashboard");
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast({
        title: "Email Required",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const { error } = await resetPassword(email);
    setLoading(false);

    if (error) {
      toast({
        title: "Reset Failed",
        description:
          error.message || "Failed to send reset email. Please try again.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Reset Email Sent",
        description: "Check your email for a password reset link",
      });
      setForgotPasswordMode(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">

          <div className="mb-8">
            <h1 className="text-4xl font-serif font-bold mb-2">
              {forgotPasswordMode ? "Reset Password" : "Welcome back"}
            </h1>
            <p className="text-muted-foreground">
              {forgotPasswordMode
                ? "Enter your email to receive a reset link"
                : "Sign in to your Lawkit account"}
            </p>
          </div>

          <form
            onSubmit={forgotPasswordMode ? handleForgotPassword : handleLogin}
            className="space-y-6"
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="rounded-full bg-[#edebbe]"
              />
            </div>

            {!forgotPasswordMode && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="rounded-full bg-[#edebbe]"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="remember"
                      checked={remember}
                      onCheckedChange={(checked) =>
                        setRemember(checked as boolean)
                      }
                    />
                    <label
                      htmlFor="remember"
                      className="text-sm cursor-pointer"
                    >
                      Remember me
                    </label>
                  </div>
                  <button
                    type="button"
                    className="text-sm text-primary hover:underline"
                    onClick={() => setForgotPasswordMode(true)}
                  >
                    Forgot password?
                  </button>
                </div>
              </>
            )}

            <Button
              type="submit"
              className="w-full rounded-full"
              size="lg"
              disabled={loading}
            >
              {loading
                ? forgotPasswordMode
                  ? "Sending..."
                  : "Signing in..."
                : forgotPasswordMode
                ? "Send Reset Link"
                : "Sign In"}
            </Button>

            {forgotPasswordMode && (
              <Button
                type="button"
                variant="ghost"
                className="w-full rounded-full"
                onClick={() => setForgotPasswordMode(false)}
              >
                Back to Sign In
              </Button>
            )}
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">
              Don't have an account?{" "}
            </span>
            <button
              onClick={() => navigate("/register")}
              className="text-primary hover:underline"
            >
              Sign up
            </button>
          </div>
        </div>
      </div>

      {/* Right Side - Brand */}
      <div className="hidden lg:flex flex-1 bg-primary text-primary-foreground p-12 items-center justify-center">
        <div className="max-w-md">
          <h2 className="text-5xl font-serif font-bold mb-6">Lawkit</h2>
          <p className="text-xl mb-8 opacity-90">
            The intelligent way to work with legal documents
          </p>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center flex-shrink-0">
                ✓
              </div>
              <p className="opacity-80">AI-powered document analysis</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center flex-shrink-0">
                ✓
              </div>
              <p className="opacity-80">Real-time collaboration</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center flex-shrink-0">
                ✓
              </div>
              <p className="opacity-80">Enterprise-grade security</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

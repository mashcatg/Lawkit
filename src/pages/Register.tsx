import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const Register = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signUp, user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    acceptTerms: false,
  });

  useEffect(() => {
    if (user) {
      const redirect = searchParams.get("redirect");
      navigate(redirect || "/dashboard");
    }
  }, [user, navigate, searchParams]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast({
        description: "Passwords don't match",
        variant: "destructive",
      });
      return;
    }
    
    if (!formData.acceptTerms) {
      toast({
        description: "Please accept the terms of service",
        variant: "destructive",
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const { error } = await signUp(formData.email, formData.password);

    if (error) {
      toast({
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
    } else {
      toast({
        description: "Account created successfully",
      });
      const redirect = searchParams.get("redirect");
      navigate(redirect || "/dashboard");
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="mb-8 rounded-full"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>

          <div className="mb-8">
            <h1 className="text-4xl font-serif font-bold mb-2">Create account</h1>
            <p className="text-muted-foreground">
              Start your free trial today
            </p>
          </div>

          <form onSubmit={handleRegister} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="rounded-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="rounded-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                className="rounded-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
                className="rounded-full"
              />
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox
                id="terms"
                checked={formData.acceptTerms}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, acceptTerms: checked as boolean })
                }
              />
              <label htmlFor="terms" className="text-sm cursor-pointer leading-relaxed">
                I agree to the{" "}
                <span className="text-primary hover:underline">Terms of Service</span> and{" "}
                <span className="text-primary hover:underline">Privacy Policy</span>
              </label>
            </div>

            <Button type="submit" className="w-full rounded-full" size="lg" disabled={loading}>
              {loading ? "Creating account..." : "Create Account"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <button
              onClick={() => navigate("/login")}
              className="text-primary hover:underline"
            >
              Sign in
            </button>
          </div>
        </div>
      </div>

      {/* Right Side - Brand */}
      <div className="hidden lg:flex flex-1 bg-primary text-primary-foreground p-12 items-center justify-center">
        <div className="max-w-md">
          <h2 className="text-5xl font-serif font-bold mb-6">Join Lawkit</h2>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of legal professionals transforming their workflow
          </p>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center flex-shrink-0">
                ✓
              </div>
              <p className="opacity-80">14-day free trial, no credit card required</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center flex-shrink-0">
                ✓
              </div>
              <p className="opacity-80">Access to all premium features</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center flex-shrink-0">
                ✓
              </div>
              <p className="opacity-80">Cancel anytime, no questions asked</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;

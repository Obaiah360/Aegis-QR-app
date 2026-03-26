import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, ArrowLeft, Mail, CheckCircle, KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type Step = "email" | "otp" | "success";

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session && step === "success") {
        // Allow the success screen to show before redirecting
      } else if (event === "SIGNED_IN" && session) {
        navigate("/dashboard");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/dashboard");
    });

    return () => subscription.unsubscribe();
  }, [navigate, step]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: true,
        },
      });
      if (error) throw error;
      setStep("otp");
      setCountdown(60);
      toast({
        title: "Code sent!",
        description: "Check your inbox for the 6-digit verification code.",
      });
    } catch (err: any) {
      toast({
        title: "Failed to send code",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) return;
    setLoading(true);

    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otp,
        type: "email",
      });
      if (error) throw error;
      setStep("success");
      setTimeout(() => navigate("/dashboard"), 2000);
    } catch (err: any) {
      toast({
        title: "Verification failed",
        description: err.message || "Invalid or expired code. Please try again.",
        variant: "destructive",
      });
      setOtp("");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      setCountdown(60);
      setOtp("");
      toast({ title: "New code sent!", description: "Check your inbox for a fresh verification code." });
    } catch (err: any) {
      toast({
        title: "Failed to resend",
        description: err.message || "Please wait a moment before trying again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background grid-pattern flex flex-col items-center justify-center px-4">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/8 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md">
        <button
          onClick={() => step === "otp" ? setStep("email") : navigate("/")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8 text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> {step === "otp" ? "Change email" : "Back to home"}
        </button>

        <div className="glass rounded-2xl p-8 border-glow">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <div className="font-bold text-lg">SecureQR Vault</div>
              <div className="text-xs text-muted-foreground">Privacy-first document security</div>
            </div>
          </div>

          {/* Success State */}
          {step === "success" && (
            <div className="text-center space-y-4 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-vault-green/10 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-vault-green" />
              </div>
              <h2 className="text-xl font-bold">You're In!</h2>
              <p className="text-sm text-muted-foreground">
                Identity verified successfully. Redirecting to your secure vault…
              </p>
            </div>
          )}

          {/* OTP Step */}
          {step === "otp" && (
            <div className="text-center space-y-6 animate-fade-in">
              <div className="space-y-2">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <KeyRound className="w-7 h-7 text-primary" />
                </div>
                <h2 className="text-xl font-bold">Enter Verification Code</h2>
                <p className="text-sm text-muted-foreground">
                  We sent a 6-digit code to{" "}
                  <span className="font-medium text-foreground">{email}</span>.
                  <br />
                  Enter it below to verify your identity.
                </p>
              </div>

              <div className="flex justify-center">
                <InputOTP maxLength={6} value={otp} onChange={(value) => setOtp(value)}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {countdown > 0 && (
                <p className="text-xs text-muted-foreground">
                  Code expires in <span className="font-mono font-semibold text-foreground">{countdown}s</span>
                </p>
              )}

              <Button
                onClick={handleVerifyOtp}
                disabled={otp.length !== 6 || loading}
                className="w-full h-11 bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-button font-semibold"
              >
                {loading ? "Verifying…" : "Verify & Sign In"}
              </Button>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Didn't receive the code? Check your spam folder or
                </p>
                <button
                  onClick={handleResend}
                  disabled={countdown > 0 || loading}
                  className={`text-sm font-medium ${
                    countdown > 0 ? "text-muted-foreground cursor-not-allowed" : "text-primary hover:underline"
                  }`}
                >
                  {countdown > 0 ? `Resend in ${countdown}s` : "Resend Code"}
                </button>
              </div>
            </div>
          )}

          {/* Email Step */}
          {step === "email" && (
            <div className="space-y-6 animate-fade-in">
              <div className="text-center space-y-2">
                <h2 className="text-xl font-bold">Passwordless Sign In</h2>
                <p className="text-sm text-muted-foreground">
                  Enter your email to receive a secure one-time login code.
                  No passwords required.
                </p>
              </div>

              <form onSubmit={handleSendOtp} className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground" /> Email Address
                  </Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    autoFocus
                    className="bg-secondary/40 border-border/60 focus:border-primary/60 h-11"
                  />
                </div>

                <div className="flex items-start gap-2 p-3 rounded-lg bg-vault-green/5 border border-vault-green/20">
                  <Shield className="w-4 h-4 text-vault-green mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    We'll send a 6-digit verification code to your inbox.
                    The code expires in 60 seconds for your security.
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full h-11 bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-button font-semibold"
                >
                  {loading ? "Sending…" : "Send Verification Code"}
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

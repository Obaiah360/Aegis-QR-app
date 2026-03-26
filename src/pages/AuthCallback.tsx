import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import AuthCard from "@/components/AuthCard";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "verified" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    // Supabase automatically processes the URL hash/code on client init.
    // We just need to wait for the session to be established.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        setStatus("verified");
        setTimeout(() => navigate("/dashboard"), 1500);
      } else if (event === "SIGNED_OUT") {
        setStatus("error");
        setErrorMsg("Authentication failed. Please try again.");
      }
    });

    // Also check immediately in case session is already set
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        setStatus("error");
        setErrorMsg(error.message);
        return;
      }
      if (session) {
        setStatus("verified");
        setTimeout(() => navigate("/dashboard"), 1500);
      }
      // If no session yet, the onAuthStateChange above will handle it
      // Give it a timeout in case nothing fires
      else {
        setTimeout(() => {
          supabase.auth.getSession().then(({ data: { session: s } }) => {
            if (!s) {
              setStatus("error");
              setErrorMsg("Authentication timed out. Please try again.");
            }
          });
        }, 5000);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (status === "loading") {
    return (
      <AuthCard title="Signing you in..." subtitle="Please wait while we verify your identity.">
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AuthCard>
    );
  }

  if (status === "error") {
    return (
      <AuthCard title="Authentication Failed" subtitle={errorMsg || "The link may have expired or is invalid."}>
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <Button onClick={() => navigate("/login")} className="w-full h-11 bg-gradient-primary text-primary-foreground">
            Go to Login
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Signed In!" subtitle="Your identity has been confirmed.">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-vault-green/10 flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8 text-vault-green" />
        </div>
        <p className="text-sm text-muted-foreground">Redirecting to your dashboard…</p>
      </div>
    </AuthCard>
  );
}

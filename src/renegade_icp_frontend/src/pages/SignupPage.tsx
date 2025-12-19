
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UserPlus, AlertCircle } from "lucide-react";
import { AuthClient } from "@dfinity/auth-client";


const SignupPage: React.FC = () => {
  const navigate = useNavigate();

  const handleInternetIdentityLogin = async () => {
    const authClient = await AuthClient.create();

    await authClient.login({
      identityProvider: "https://identity.ic0.app", // II URL
      onSuccess: () => {
        console.log("Logged in with Internet Identity");
        // You can now get the identity and pass it to your agent
        const identity = authClient.getIdentity();
        // Navigate to dashboard or wherever
        navigate("/dashboard");
      },
    });
  };

  return (
    <div className="relative min-h-screen">
      {/* Background image layer */}
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1639322537228-f710d846310a')] bg-cover bg-center opacity-10"></div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background"></div>

      {/* Main content */}
      <div className="relative z-10 flex items-center justify-center min-h-[calc(100vh-8rem)] px-4 py-12">
        <div className="w-full max-w-md">
          <Card className="cyber-card">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold text-center">Sign In</CardTitle>
              <CardDescription className="text-center">
                Use Internet Identity to access your account
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-4">
              <Button
                onClick={handleInternetIdentityLogin}
                className="w-full bg-renegade-green hover:bg-renegade-green/80 text-black"
              >
                Sign in with Internet Identity
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>

  );
};

export default SignupPage;
/**
 * <label
                  htmlFor="terms"
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  I accept the{" "}
                  <Link to="/terms" className="text-renegade-green hover:underline">
                    terms and conditions
                  </Link>
                </label>
              </div>
 * 
 * 
 */
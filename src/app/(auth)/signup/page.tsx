"use client";

import { useState, useTransition, useEffect, Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, User, UserCheck, Shield, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { signup } from "@/app/actions/auth";
import { createClient } from "@/utils/supabase/client";

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["candidate", "interviewer", "admin"], {
    message: "Please select a role",
  }),
});

type SignupFormValues = z.infer<typeof signupSchema>;

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const inviteToken = searchParams.get("token");
  const inviteEmail = searchParams.get("email");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: inviteEmail || "",
      password: "",
      role: inviteEmail ? "candidate" : "candidate",
    },
  });

  // Prefill email and set role to candidate if an invite query parameter is present
  useEffect(() => {
    if (inviteEmail) {
      setValue("email", inviteEmail, { shouldValidate: true });
      setValue("role", "candidate", { shouldValidate: true });
    }
  }, [inviteEmail, setValue]);

  const selectedRole = watch("role");

  const onSubmit = (data: SignupFormValues) => {
    // If signed up via invite, ensure role is forced to candidate
    const finalData = inviteEmail ? { ...data, role: "candidate" as const } : data;

    console.log("[Signup Page] Submitting signup form with payload:", finalData);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("name", finalData.name);
        formData.append("email", finalData.email);
        formData.append("password", finalData.password);
        formData.append("role", finalData.role);

        console.log("[Signup Page] Invoking signup server action with formData...");
        const result = await signup(formData);
        console.log("[Signup Page] Received signup result:", result);
        
        if (result?.error) {
          toast.error(result.error);
        } else if (result?.success) {
          toast.success(inviteEmail 
            ? "Account created and interview linked successfully!" 
            : "Account created successfully!"
          );
          router.push("/dashboard");
        }
      } catch (error) {
        toast.error("An unexpected error occurred during signup");
        console.error(error);
      }
    });
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        throw error;
      }
    } catch (error: any) {
      console.error("[Google OAuth Client Error]", error);
      toast.error(error.message || "Failed to sign in with Google");
      setIsGoogleLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-card border shadow-xl rounded-2xl p-8 backdrop-blur-sm bg-white/50 dark:bg-zinc-900/50"
    >
      <div className="text-center mb-8">
        <h1 className="text-2xl font-semibold tracking-tight mb-2">Create an account</h1>
        <p className="text-muted-foreground text-sm">
          {inviteEmail 
            ? "Configure your login credentials to accept your invitation" 
            : "Join InterviewAI to start your journey"
          }
        </p>
      </div>

      {/* Invite Notification Banner */}
      {inviteEmail && (
        <div className="mb-6 p-4 rounded-xl border border-violet-500/20 bg-violet-500/10 text-zinc-100 flex items-start gap-3">
          <Shield className="h-5 w-5 text-violet-400 shrink-0 mt-0.5 animate-pulse" />
          <div className="text-xs">
            <p className="font-semibold text-violet-300">Technical Interview Pending</p>
            <p className="text-zinc-300 mt-0.5">
              Creating a secure candidate account for <strong className="text-white">{inviteEmail}</strong>. 
              Once registered, your scheduled interview rooms will be instantly active!
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        
        {/* Hide Role Selection if invited, role is locked to candidate */}
        {!inviteEmail ? (
          <div className="space-y-3 mb-6">
            <Label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Select your role</Label>
            <div 
              className="grid grid-cols-3 gap-3"
              role="radiogroup"
              aria-label="Select your role"
            >
              {[
                { value: "candidate", label: "Candidate", icon: User },
                { value: "interviewer", label: "Interviewer", icon: UserCheck },
                { value: "admin", label: "Admin", icon: Shield },
              ].map((roleOption) => {
                const Icon = roleOption.icon;
                const isSelected = selectedRole === roleOption.value;
                return (
                  <button
                    key={roleOption.value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={0}
                    onClick={() => {
                      console.log("[Signup Page] Explicit role card click:", roleOption.value);
                      setValue("role", roleOption.value as any, { shouldValidate: true });
                    }}
                    className={cn(
                      "flex flex-col items-center justify-between rounded-xl border-2 p-3 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50 cursor-pointer transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary text-center",
                      isSelected
                        ? "border-primary bg-primary/5 text-primary shadow-sm dark:bg-primary/10 dark:text-primary-400"
                        : "border-zinc-200 dark:border-zinc-800 bg-transparent text-muted-foreground"
                    )}
                  >
                    <Icon className={cn("mb-2 h-5 w-5 transition-transform", isSelected ? "text-primary scale-110" : "text-muted-foreground")} />
                    <span className="text-xs font-semibold">{roleOption.label}</span>
                  </button>
                );
              })}
            </div>
            {errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Your Role</Label>
            <div className="flex items-center gap-2 px-3 py-2 bg-stone-900/60 border border-stone-850 rounded-lg text-zinc-300 text-sm">
              <User className="h-4 w-4 text-violet-400" />
              <span>Locked to Candidate (Scheduled Interview Candidate)</span>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <Input
            id="name"
            placeholder="John Doe"
            {...register("name")}
            disabled={isPending}
            className={errors.name ? "border-destructive" : ""}
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="m@example.com"
            {...register("email")}
            disabled={isPending || !!inviteEmail}
            className={cn(
              errors.email ? "border-destructive" : "",
              inviteEmail && "bg-stone-900/40 border-stone-800 text-zinc-400 select-none cursor-not-allowed"
            )}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            {...register("password")}
            disabled={isPending}
            className={errors.password ? "border-destructive" : ""}
          />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        <Button type="submit" className="w-full mt-2" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating account...
            </>
          ) : (
            inviteEmail ? "Accept Invite & Create Account" : "Create Account"
          )}
        </Button>
      </form>

      {!inviteEmail && (
        <>
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <Button
            variant="outline"
            type="button"
            className="w-full"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading || isPending}
          >
            {isGoogleLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
              </svg>
            )}
            Google
          </Button>
        </>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-primary hover:underline font-medium">
          Sign in
        </Link>
      </p>
    </motion.div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center p-12 bg-card border shadow-xl rounded-2xl min-h-[350px]">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500 mb-4" />
        <p className="text-sm text-zinc-400 font-medium">Loading signup portal...</p>
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}

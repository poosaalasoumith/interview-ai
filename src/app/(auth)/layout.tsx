import React from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/ui/brand-logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 relative overflow-hidden">
      {/* Premium Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-500/10 via-background to-background"></div>
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl opacity-50"></div>
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl opacity-50"></div>

      <div className="w-full max-w-md p-6 relative z-10">
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <BrandLogo size="lg" className="w-10 h-10 bg-primary/10 rounded-xl p-1.5 flex items-center justify-center group-hover:bg-primary/20 transition-all duration-300 shadow-md shadow-primary/5" />
            <span className="font-bold text-2xl tracking-tight">InterviewAI</span>
          </Link>
        </div>
        
        {children}
        
      </div>
    </div>
  );
}

"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface BrandLogoProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg" | "xl";
}

export function BrandLogo({ className, size = "md", ...props }: BrandLogoProps) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-10 h-10",
    xl: "w-12 h-12",
  };

  return (
    <div 
      className={cn("relative overflow-hidden flex items-center justify-center shrink-0", sizeClasses[size], className)} 
      {...props}
    >
      <Image
        src="/logo.png"
        alt="InterviewAI Brand Logo"
        fill
        sizes="(max-width: 768px) 40px, 80px"
        className="object-contain dark:invert transition-transform duration-300 group-hover:scale-105"
        priority
      />
    </div>
  );
}

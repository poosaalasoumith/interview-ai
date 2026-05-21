"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { cn } from "@/lib/utils";

export function SidebarLink({ 
  href, 
  children, 
  className 
}: { 
  href: string; 
  children: React.ReactNode; 
  className?: string 
}) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={cn(
        className,
        isActive 
          ? "bg-primary/10 text-primary border-l-2 border-primary font-semibold pl-2.5 pr-3 py-2 rounded-r-md rounded-l-none" 
          : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
      )}
    >
      {children}
    </Link>
  );
}

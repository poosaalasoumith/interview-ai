"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import { isValidRoute } from "@/lib/routes";

interface SafeLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
}

export function SafeLink({ href, children, className, ...props }: SafeLinkProps) {
  const router = useRouter();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // If the user is using modifier keys (ctrl, cmd, shift, alt) or target="_blank", let the browser handle it naturally
    if (
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      props.target === "_blank"
    ) {
      return;
    }

    e.preventDefault();
    const pathOnly = href.split("?")[0].split("#")[0];

    if (!isValidRoute(pathOnly)) {
      console.warn(`[Safe Navigation Interceptor] Blocked invalid navigation to: ${href}`);
      
      // Recovery phase
      router.refresh();
      setTimeout(() => {
        router.push("/dashboard");
      }, 500);
      return;
    }

    router.push(href);
  };

  return (
    <Link href={href} className={className} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { isValidRoute } from "@/lib/routes";

export function useSafeNavigate() {
  const router = useRouter();

  const safeNavigate = (href: string, options?: { replace?: boolean }) => {
    if (!href) return;

    const pathOnly = href.split("?")[0].split("#")[0];

    if (!isValidRoute(pathOnly)) {
      console.warn(`[Safe Navigation Hook] Blocked invalid navigation to: ${href}`);
      
      // Attempt recovery
      router.refresh();
      setTimeout(() => {
        router.push("/dashboard");
      }, 500);
      return;
    }

    if (options?.replace) {
      router.replace(href);
    } else {
      router.push(href);
    }
  };

  return { safeNavigate };
}

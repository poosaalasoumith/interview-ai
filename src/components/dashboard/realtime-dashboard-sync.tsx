"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { isSessionFinalized, getSessionStatusLabel } from "@/utils/interview-utils";

export function RealtimeDashboardSync() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams?.get("error");

  // Handle URL redirect query param for ended session
  useEffect(() => {
    if (error === "ended") {
      toast.error("This interview session has ended.", {
        id: "session-ended-toast",
        duration: 6000,
      });
      
      // Clean query parameter from browser address bar history to prevent toast loop replays
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("error");
        window.history.replaceState({}, "", url.toString());
      } catch (e) {
        console.error("Failed to clean URL search parameters:", e);
      }
    }
  }, [error]);

  useEffect(() => {
    const supabase = createClient();

    // Subscribe to all changes on the interviews table
    const channel = supabase
      .channel("dashboard-interviews-realtime-sync")
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to INSERT, UPDATE, DELETE
          schema: "public",
          table: "interviews"
        },
        (payload) => {
          console.log("[Realtime Sync] Database interviews mutation captured:", payload);
          
          // Dynamically refresh Next.js server components data on the page
          router.refresh();
          
          if (payload.eventType === "UPDATE") {
            const oldStatus = (payload.old as any)?.session_status;
            const newStatus = (payload.new as any)?.session_status;
            
            // Present status-specific notifications for finalization transitions
            if (oldStatus !== newStatus && newStatus) {
              const label = getSessionStatusLabel(newStatus);

              if (isSessionFinalized(newStatus)) {
                // Finalization-specific premium notifications
                switch (newStatus.toLowerCase()) {
                  case "completed":
                  case "submitted":
                    toast.success(`Assessment finalized: ${label.toUpperCase()}`, {
                      id: "realtime-db-lifecycle-toast",
                      duration: 5000,
                      description: "Session has been permanently closed.",
                    });
                    break;
                  case "terminated":
                    toast.error(`Session ${label.toUpperCase()} by proctor`, {
                      id: "realtime-db-lifecycle-toast",
                      duration: 6000,
                      description: "The session was forcefully terminated. Re-entry is blocked.",
                    });
                    break;
                  case "expired":
                  case "missed":
                  case "canceled":
                  case "cancelled":
                    toast.warning(`Session status: ${label.toUpperCase()}`, {
                      id: "realtime-db-lifecycle-toast",
                      duration: 5000,
                      description: "This session has been permanently closed.",
                    });
                    break;
                  default:
                    toast.info(`Assessment status updated to: ${label.toUpperCase()}`, {
                      id: "realtime-db-lifecycle-toast",
                      duration: 4000,
                    });
                }
              } else {
                toast.info(`Assessment status updated to: ${label.toUpperCase()}`, {
                  id: "realtime-db-lifecycle-toast",
                  duration: 4000,
                });
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null; // Renderless utility hook component
}

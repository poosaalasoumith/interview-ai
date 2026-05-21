"use client";

import React, { useState, useEffect } from "react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
}

export function InteractiveNotifications({ role }: { role: string }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [mounted, setMounted] = useState(false);

  // Load default notifications based on roles
  useEffect(() => {
    setMounted(true);
    const defaults: Record<string, NotificationItem[]> = {
      candidate: [
        {
          id: "cand-1",
          title: "Upcoming Live Interview",
          description: "Your scheduled coding interview round with the Senior Technical Recruiter is coming up.",
          time: "5h ago",
          read: false
        },
        {
          id: "cand-2",
          title: "AI Code Review Completed",
          description: "Gemini completed the evaluation of your recent algorithmic solution. Check the review dashboard.",
          time: "2h ago",
          read: false
        },
        {
          id: "cand-3",
          title: "Candidate Profile Synced",
          description: "Your display name and selected high-resolution avatar are fully synchronized.",
          time: "1d ago",
          read: true
        }
      ],
      interviewer: [
        {
          id: "int-1",
          title: "Technical Evaluation Needed",
          description: "The interview round for candidate John Doe is complete. Ready to record score and reviews.",
          time: "30m ago",
          read: false
        },
        {
          id: "int-2",
          title: "New Candidate Booking",
          description: "Candidate Alice Smith scheduled a Python programming round for next Tuesday.",
          time: "3.h ago",
          read: false
        },
        {
          id: "int-3",
          title: "Token Server Synchronized",
          description: "Low-latency LiveKit collaborative credentials verified and refreshed.",
          time: "1d ago",
          read: true
        }
      ],
      admin: [
        {
          id: "admin-1",
          title: "All Nodes Operational",
          description: "Gemini 2.5-Flash model calls, Piston sandboxes, and Auth routers are running smoothly.",
          time: "Just now",
          read: false
        },
        {
          id: "admin-2",
          title: "CLI Database Migrations",
          description: "Safely applied versioned schema migrations to Supabase Cloud without data loss.",
          time: "2h ago",
          read: false
        },
        {
          id: "admin-3",
          title: "Active Live Lobby Count",
          description: "14 collaborative Monaco editor sessions active across all organizational partitions.",
          time: "4h ago",
          read: true
        }
      ]
    };

    setNotifications(defaults[role] || []);
  }, [role]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
    toast.success("Notification marked as read");
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    toast.success("All alerts marked as read");
  };

  const clearAll = () => {
    setNotifications([]);
    toast.success("All alerts cleared");
  };

  if (!mounted) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="h-9 w-9 rounded-md border border-border/50 bg-background/50 backdrop-blur-sm relative cursor-pointer hover:bg-zinc-850 hover:text-zinc-100 transition flex items-center justify-center focus:outline-none">
        <Bell className="h-4 w-4 text-zinc-300" />
        {unreadCount > 0 && (
          <>
            <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="absolute -top-1.5 -right-1.5 bg-primary text-[9px] font-black text-primary-foreground h-4 w-4 rounded-full flex items-center justify-center border border-zinc-950 scale-90">
              {unreadCount}
            </span>
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-85 border-zinc-800 bg-zinc-950/95 backdrop-blur-md p-0 font-sans rounded-xl shadow-2xl" align="end">
        <DropdownMenuLabel className="font-bold flex items-center justify-between py-3 px-4 bg-zinc-900/30">
          <div className="flex items-center gap-2">
            <span className="text-white text-xs">Live System Alerts</span>
            {unreadCount > 0 && (
              <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/20 tracking-wider font-extrabold px-1.5 py-0.5">
                {unreadCount} NEW
              </Badge>
            )}
          </div>
          {notifications.length > 0 && (
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    markAllAsRead();
                  }}
                  className="text-[10px] text-primary hover:underline flex items-center gap-0.5 cursor-pointer font-semibold"
                >
                  <Check className="w-3 h-3" /> Mark all read
                </button>
              )}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  clearAll();
                }}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-0.5 cursor-pointer font-semibold"
              >
                <Trash2 className="w-3 h-3" /> Clear all
              </button>
            </div>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-zinc-850 m-0" />
        
        <div className="max-h-[300px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="py-10 text-center text-zinc-650 text-xs flex flex-col items-center justify-center gap-2">
              <Bell className="w-6 h-6 text-zinc-800" />
              <span>You have no notifications at this time</span>
            </div>
          ) : (
            notifications.map((n, idx) => (
              <div key={n.id} className="contents">
                {idx > 0 && <DropdownMenuSeparator className="bg-zinc-850 m-0" />}
                <DropdownMenuItem 
                  onClick={() => !n.read && markAsRead(n.id)}
                  className={cn(
                    "flex flex-col items-start gap-1 p-3.5 focus:bg-zinc-900/60 cursor-pointer transition-colors outline-none",
                    !n.read ? "bg-primary/5 border-l-2 border-primary pl-3" : "pl-3.5 opacity-70"
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className={cn(
                      "text-xs font-bold font-sans",
                      !n.read ? "text-white" : "text-zinc-300"
                    )}>
                      {n.title}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">{n.time}</span>
                  </div>
                  <span className="text-xs text-zinc-400 font-sans leading-relaxed mt-0.5">
                    {n.description}
                  </span>
                  {!n.read && (
                    <div className="text-[9px] text-primary font-bold mt-1.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span>Click to mark as read</span>
                    </div>
                  )}
                </DropdownMenuItem>
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { 
  Dialog, 
  DialogContent, 
  DialogTitle 
} from "@/components/ui/dialog";
import { 
  Search, 
  LayoutDashboard, 
  Calendar, 
  Code, 
  Settings, 
  User, 
  FileCode2,
  LogOut, 
  Sun, 
  Moon, 
  Command,
  ArrowRight
} from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

interface CommandItem {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<any>;
  category: string;
  action: () => void;
}

export function CommandMenu({ role }: { role: string }) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Define commands based on roles
  const getCommands = (): CommandItem[] => {
    const baseCommands: CommandItem[] = [
      {
        id: "profile",
        title: "My Account Profile",
        subtitle: "View credentials, select avatar, and customize presence",
        icon: User,
        category: "Account & Settings",
        action: () => router.push(`/dashboard/${role}/profile`)
      },
      {
        id: "settings",
        title: "System Preferences",
        subtitle: "Modify Monaco autocomplete, audio/video streaming, and alerts",
        icon: Settings,
        category: "Account & Settings",
        action: () => router.push(`/dashboard/${role}/settings`)
      },
      {
        id: "theme-toggle",
        title: theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode",
        subtitle: "Change application theme preference",
        icon: theme === "dark" ? Sun : Moon,
        category: "Quick Actions",
        action: () => setTheme(theme === "dark" ? "light" : "dark")
      },
      {
        id: "logout",
        title: "Log Out",
        subtitle: "Sign out of your active session securely",
        icon: LogOut,
        category: "Quick Actions",
        action: () => signOut()
      }
    ];

    const roleSpecificCommands: CommandItem[] = [];

    if (role === "candidate") {
      roleSpecificCommands.push(
        {
          id: "cand-overview",
          title: "Go to Candidate Overview",
          subtitle: "View your interview scheduling and feedback scores",
          icon: LayoutDashboard,
          category: "Navigation",
          action: () => router.push("/dashboard/candidate")
        },
        {
          id: "cand-interviews",
          title: "View My Interviews",
          subtitle: "Browse your scheduled LiveKit coding rounds",
          icon: Calendar,
          category: "Navigation",
          action: () => router.push("/dashboard/candidate/interviews")
        },
        {
          id: "cand-practice",
          title: "Practice Playground",
          subtitle: "Launch autonomous Monaco compiler sandbox",
          icon: Code,
          category: "Navigation",
          action: () => router.push("/dashboard/candidate/practice")
        },
        {
          id: "cand-submissions",
          title: "Submissions History",
          subtitle: "Review your past Piston compiled code submissions",
          icon: FileCode2,
          category: "Navigation",
          action: () => router.push("/dashboard/candidate/submissions")
        }
      );
    } else if (role === "interviewer") {
      roleSpecificCommands.push(
        {
          id: "int-overview",
          title: "Go to Interviewer Overview",
          subtitle: "Check active rooms and dynamic assessment queues",
          icon: LayoutDashboard,
          category: "Navigation",
          action: () => router.push("/dashboard/interviewer")
        },
        {
          id: "int-schedule",
          title: "Schedule Round",
          subtitle: "Create a new synchronized interview session lobby",
          icon: Calendar,
          category: "Navigation",
          action: () => router.push("/dashboard/interviewer/interviews")
        }
      );
    } else if (role === "admin") {
      roleSpecificCommands.push(
        {
          id: "admin-overview",
          title: "Go to Admin Overview",
          subtitle: "Check live telemetry, API status, and usage graphs",
          icon: LayoutDashboard,
          category: "Navigation",
          action: () => router.push("/dashboard/admin")
        },
        {
          id: "admin-interviews",
          title: "Manage Interviews",
          subtitle: "Audit active coding lobbies and create schedules",
          icon: Calendar,
          category: "Navigation",
          action: () => router.push("/dashboard/admin/interviews")
        }
      );
    }

    return [...roleSpecificCommands, ...baseCommands];
  };

  const allCommands = getCommands();
  const filteredCommands = allCommands.filter(cmd => 
    cmd.title.toLowerCase().includes(query.toLowerCase()) ||
    cmd.subtitle.toLowerCase().includes(query.toLowerCase()) ||
    cmd.category.toLowerCase().includes(query.toLowerCase())
  );

  // Register Keyboard Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Keyboard navigation inside list
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => 
        prev < filteredCommands.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => 
        prev > 0 ? prev - 1 : filteredCommands.length - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  // Group commands by category for display
  const categories = Array.from(new Set(filteredCommands.map(cmd => cmd.category)));

  // Flattened absolute index finder for click selection
  let currentFlattenedIndex = 0;

  return (
    <>
      {/* Visual Command bar activator button */}
      <button 
        onClick={() => setOpen(true)}
        className="w-full max-w-[240px] md:max-w-[280px] bg-zinc-900/40 backdrop-blur-md hover:bg-zinc-900/60 text-muted-foreground border border-zinc-800/80 hover:border-zinc-700/80 px-3.5 py-1.5 h-9 rounded-lg flex items-center justify-between text-xs font-sans transition-all cursor-pointer group"
      >
        <div className="flex items-center gap-2">
          <Search className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
          <span>Quick actions & routes...</span>
        </div>
        <div className="flex gap-0.5 items-center bg-zinc-950 border border-zinc-800/80 px-1.5 py-0.5 rounded text-[10px] font-mono text-zinc-400 group-hover:text-zinc-200">
          <Command className="w-2.5 h-2.5" />
          <span>K</span>
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent 
          className="max-w-2xl bg-zinc-950/90 border border-zinc-850 backdrop-blur-xl p-0 overflow-hidden font-sans gap-0 rounded-2xl shadow-2xl"
          onKeyDown={handleKeyDown}
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">Quick Command Menu</DialogTitle>
          
          {/* Search bar input container */}
          <div className="flex items-center px-4 border-b border-zinc-850 h-14 gap-3 bg-zinc-950/40">
            <Search className="w-5 h-5 text-zinc-400 shrink-0" />
            <input 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a page, setting, or quick command..."
              className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 border-none outline-none ring-0 h-full py-3"
              autoFocus
            />
            <div className="flex gap-1 items-center bg-zinc-900 px-2 py-1 rounded text-[10px] font-mono text-zinc-400 border border-zinc-800">
              ESC to close
            </div>
          </div>

          {/* Results list */}
          <div 
            ref={listRef}
            className="max-h-[360px] overflow-y-auto p-2 space-y-4"
          >
            {filteredCommands.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 text-xs flex flex-col items-center justify-center gap-2">
                <Command className="w-8 h-8 text-zinc-700 animate-pulse" />
                <span>No commands or pages match your search</span>
              </div>
            ) : (
              categories.map(category => {
                const categoryCommands = filteredCommands.filter(c => c.category === category);
                return (
                  <div key={category} className="space-y-1">
                    <h4 className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 px-3 py-1">
                      {category}
                    </h4>
                    <div className="space-y-0.5">
                      {categoryCommands.map(cmd => {
                        const globalIndex = filteredCommands.findIndex(c => c.id === cmd.id);
                        const isSelected = globalIndex === selectedIndex;

                        return (
                          <button
                            key={cmd.id}
                            onClick={() => {
                              cmd.action();
                              setOpen(false);
                            }}
                            onMouseEnter={() => setSelectedIndex(globalIndex)}
                            className={cn(
                              "w-full text-left flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-150 cursor-pointer group",
                              isSelected 
                                ? "bg-primary/10 border border-primary/20 text-white" 
                                : "border border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30"
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={cn(
                                "p-2 rounded-md transition-colors shrink-0",
                                isSelected ? "bg-primary/20 text-primary" : "bg-zinc-900 text-zinc-400 group-hover:bg-zinc-850 group-hover:text-zinc-300"
                              )}>
                                <cmd.icon className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className={cn(
                                  "text-xs font-semibold truncate",
                                  isSelected ? "text-white" : "text-zinc-200"
                                )}>
                                  {cmd.title}
                                </p>
                                <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                                  {cmd.subtitle}
                                </p>
                              </div>
                            </div>
                            
                            {isSelected && (
                              <div className="flex items-center gap-1 text-[10px] font-medium text-primary shrink-0 animate-in fade-in slide-in-from-right-2 duration-150">
                                <span>Go</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          {/* Menu Footer */}
          <div className="border-t border-zinc-850 px-4 py-2.5 bg-zinc-950/60 flex justify-between items-center text-[10px] text-zinc-500 font-mono">
            <div className="flex gap-2">
              <span className="flex items-center gap-1"><span className="border border-zinc-800 bg-zinc-900 px-1 py-0.2 rounded font-sans text-xs">↑↓</span> to navigate</span>
              <span className="flex items-center gap-1"><span className="border border-zinc-800 bg-zinc-900 px-1 py-0.2 rounded font-sans text-xs">↵</span> to select</span>
            </div>
            <div>
              <span>Role: <span className="text-primary font-bold">{role}</span></span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

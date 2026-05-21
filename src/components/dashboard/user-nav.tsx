"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/app/actions/auth";
import { User as UserIcon, Settings, LogOut, Code } from "lucide-react";
import Link from "next/link";

interface UserNavProps {
  user: any;
  role: string;
}

export function UserNav({ user, role }: UserNavProps) {
  const initials = user?.user_metadata?.full_name
    ?.split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase() || "U";

  // Standardize the dashboard URL path prefix based on the user role
  const rolePath = role === "interviewer" ? "interviewer" : role === "admin" ? "admin" : "candidate";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger id="user-nav-dropdown-trigger" className="relative h-9 w-9 rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 overflow-hidden flex items-center justify-center cursor-pointer group">
        <Avatar className="h-9 w-9 border border-zinc-800 transition-all group-hover:border-primary/50">
          <AvatarImage src={user?.user_metadata?.avatar_url} alt="Avatar" />
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 bg-zinc-900 border-zinc-800 text-zinc-100" align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-semibold leading-none text-white">
                {user?.user_metadata?.full_name || "User"}
              </p>
              <p className="text-xs leading-none text-zinc-400 font-mono">
                {user?.email}
              </p>
              <div id="user-nav-role-label" className="mt-2 text-[10px] uppercase tracking-wider font-extrabold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-sm inline-flex w-fit">
                {role}
              </div>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="bg-zinc-800" />
        <DropdownMenuGroup className="space-y-0.5">
          <DropdownMenuItem
            render={<Link href={`/dashboard/${rolePath}/profile`} />}
            className="w-full cursor-pointer focus:bg-zinc-800 focus:text-white transition-colors py-2 flex items-center group/dropdown-menu-item"
          >
            <UserIcon className="mr-2.5 h-4 w-4 text-zinc-400 group-hover/dropdown-menu-item:text-primary group-focus/dropdown-menu-item:text-primary transition-colors" />
            <span>Profile</span>
          </DropdownMenuItem>
          {rolePath === 'candidate' && (
            <DropdownMenuItem
              render={<Link href="/dashboard/candidate/submissions" />}
              className="w-full cursor-pointer focus:bg-zinc-800 focus:text-white transition-colors py-2 flex items-center group/dropdown-menu-item"
            >
              <Code className="mr-2.5 h-4 w-4 text-zinc-400 group-hover/dropdown-menu-item:text-primary group-focus/dropdown-menu-item:text-primary transition-colors" />
              <span>Code Submissions</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            render={<Link href={`/dashboard/${rolePath}/settings`} />}
            className="w-full cursor-pointer focus:bg-zinc-800 focus:text-white transition-colors py-2 flex items-center group/dropdown-menu-item"
          >
            <Settings className="mr-2.5 h-4 w-4 text-zinc-400 group-hover/dropdown-menu-item:text-primary group-focus/dropdown-menu-item:text-primary transition-colors" />
            <span>Settings</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="bg-zinc-800" />
        <DropdownMenuItem 
          className="w-full cursor-pointer text-red-400 focus:text-red-400 focus:bg-red-500/10 transition-colors py-2 font-medium"
          onClick={() => signOut()}
        >
          <LogOut className="mr-2.5 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

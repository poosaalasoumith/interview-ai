// src/lib/navigation.ts
import { Routes } from "./routes";
import { LayoutDashboard, Calendar, Code, FileCode2, Settings, BarChart3 } from "lucide-react";

export const SidebarNavigation = {
  candidate: [
    { href: Routes.candidateOverview, label: "Overview", icon: LayoutDashboard },
    { href: Routes.candidateInterviews, label: "My Interviews", icon: Calendar },
    { href: Routes.candidatePractice, label: "Practice Playground", icon: Code },
    { href: Routes.candidateSubmissions, label: "Submissions History", icon: FileCode2 },
    { href: Routes.candidateAnalytics, label: "Analytics", icon: BarChart3 },
    { href: Routes.candidateSettings, label: "System Preferences", icon: Settings },
  ],
  interviewer: [
    { href: Routes.interviewerOverview, label: "Overview", icon: LayoutDashboard },
    { href: Routes.interviewerInterviews, label: "Schedule Round", icon: Calendar },
    { href: Routes.interviewerSettings, label: "System Preferences", icon: Settings },
  ],
  admin: [
    { href: Routes.adminOverview, label: "Console Overview", icon: LayoutDashboard },
    { href: Routes.adminInterviews, label: "Manage Interviews", icon: Calendar },
    { href: Routes.adminSettings, label: "System Preferences", icon: Settings },
  ],
};

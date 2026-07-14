"use client";

import { usePathname } from "next/navigation";
import { 
  Breadcrumb, 
  BreadcrumbItem, 
  BreadcrumbLink, 
  BreadcrumbList, 
  BreadcrumbPage, 
  BreadcrumbSeparator 
} from "@/components/ui/breadcrumb";
import { SafeLink } from "@/components/ui/safe-link";
import { Routes } from "@/lib/routes";

export function DynamicBreadcrumbs({ role }: { role: string }) {
  const pathname = usePathname();
  
  // Map segments to friendly UX titles
  const getSegmentLabel = (segment: string) => {
    switch (segment) {
      case "candidate": return "Candidate Overview";
      case "interviewer": return "Interviewer Overview";
      case "admin": return "Administrator Overview";
      case "interviews": return "Lobby & Scheduled Round";
      case "practice": return "Practice Playground";
      case "submissions": return "Submissions History";
      case "settings": return "System Preferences";
      case "profile": return "Account Settings";
      case "review": return "Evaluation Queue";
      default: return segment.charAt(0).toUpperCase() + segment.slice(1);
    }
  };

  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbItems: { label: string; href: string; isLast: boolean }[] = [];
  let currentPath = "";

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    currentPath += `/${segment}`;
    
    // Ignore standard dashboard base prefix
    if (segment === "dashboard") continue;

    const label = getSegmentLabel(segment);
    const isLast = i === segments.length - 1;

    breadcrumbItems.push({
      label,
      href: currentPath,
      isLast
    });
  }

  const overviewRoute = role === "admin" ? Routes.adminOverview : role === "interviewer" ? Routes.interviewerOverview : Routes.candidateOverview;

  return (
    <Breadcrumb className="hidden md:flex">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink render={<SafeLink href={overviewRoute} />} className="text-zinc-400 hover:text-zinc-200 capitalize font-medium">
            Workspace
          </BreadcrumbLink>
        </BreadcrumbItem>
        {breadcrumbItems.map((item) => (
          <span key={item.href} className="contents">
            <BreadcrumbSeparator className="text-zinc-600" />
            <BreadcrumbItem>
              {item.isLast ? (
                <BreadcrumbPage className="text-zinc-100 font-bold">{item.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink render={<SafeLink href={item.href} />} className="text-zinc-400 hover:text-zinc-200 font-medium">
                  {item.label}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </span>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

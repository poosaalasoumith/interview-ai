// src/lib/routes.ts

export const RoutesConfig = {
  home: "/",
  login: "/login",
  signup: "/signup",
  forgotPassword: "/forgot-password",
  dashboard: "/dashboard",
  candidateOverview: "/dashboard/candidate",
  candidateInterviews: "/dashboard/candidate/interviews",
  candidatePractice: "/dashboard/candidate/practice",
  candidateSubmissions: "/dashboard/candidate/submissions",
  candidateSubmissionDetail: "/dashboard/candidate/submissions/[id]",
  candidateReview: "/dashboard/candidate/review/[id]",
  candidateSettings: "/dashboard/candidate/settings",
  candidateProfile: "/dashboard/candidate/profile",
  candidateAnalytics: "/dashboard/analytics",
  interviewerOverview: "/dashboard/interviewer",
  interviewerInterviews: "/dashboard/interviewer/interviews",
  interviewerSettings: "/dashboard/interviewer/settings",
  interviewerProfile: "/dashboard/interviewer/profile",
  interviewerReview: "/dashboard/interviewer/review/[id]",
  adminOverview: "/dashboard/admin",
  adminInterviews: "/dashboard/admin/interviews",
  adminSettings: "/dashboard/admin/settings",
  adminProfile: "/dashboard/admin/profile",
  interviewRoom: "/interview/[roomId]",
  interviewNext: "/interview/next",
  practiceInterviewSession: "/practice/interview/[sessionId]",
} as const;

export const Routes = {
  ...RoutesConfig,
  candidateSubmission: (id: string) => `/dashboard/candidate/submissions/${id}` as const,
  candidateReview: (id: string) => `/dashboard/candidate/review/${id}` as const,
  interviewerReview: (id: string) => `/dashboard/interviewer/review/${id}` as const,
  interview: (roomId: string) => `/interview/${roomId}` as const,
  practice: (sessionId: string) => `/practice/interview/${sessionId}` as const,
};

// Check if a path (ignoring query params/hash) matches one of our configured routes
export function isValidRoute(path: string): boolean {
  if (!path) return false;
  
  // Normalize path by removing trailing slash if not root
  const normalizedPath = path === "/" ? "/" : path.replace(/\/$/, "");

  for (const pattern of Object.values(RoutesConfig)) {
    // Convert dynamic segments [id] to regex capture groups ([^/]+)
    const regexPattern = "^" + pattern
      .replace(/\[[a-zA-Z0-9_-]+\]/g, "([^/]+)")
      .replace(/\//g, "\\/") + "$";
    
    if (new RegExp(regexPattern).test(normalizedPath)) {
      return true;
    }
  }
  return false;
}

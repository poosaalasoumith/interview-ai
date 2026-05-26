/**
 * Enterprise-grade Interview Session Finalization Utilities
 * 
 * Single source of truth for determining whether a session is finalized,
 * its human-readable label, and its status-specific styling.
 * 
 * Used across: server actions, API routes, room pages, dashboard components,
 * realtime sync handlers, and the interview client.
 */

/** All terminal/finalized session_status values. Once a session enters any of these, it is permanently closed. */
export const FINALIZED_STATUSES = [
  "completed",
  "submitted",
  "expired",
  "terminated",
  "canceled",
  "cancelled",
  "missed",
] as const;

export type FinalizedStatus = (typeof FINALIZED_STATUSES)[number];

/**
 * Check if a session_status value represents a permanently finalized session.
 * A finalized session cannot be re-entered, re-joined, or restarted.
 */
export function isSessionFinalized(sessionStatus: string | null | undefined): boolean {
  if (!sessionStatus) return false;
  return FINALIZED_STATUSES.includes(sessionStatus.toLowerCase() as FinalizedStatus);
}

/**
 * Returns a human-readable label for a session status.
 */
export function getSessionStatusLabel(status: string | null | undefined): string {
  if (!status) return "Unknown";
  const normalized = status.toLowerCase();
  switch (normalized) {
    case "completed":
      return "Completed";
    case "submitted":
      return "Submitted";
    case "expired":
      return "Expired";
    case "terminated":
      return "Terminated";
    case "canceled":
    case "cancelled":
      return "Canceled";
    case "missed":
      return "Missed";
    case "scheduled":
      return "Scheduled";
    case "waiting":
      return "Waiting";
    case "active":
    case "late_joined":
      return "Live";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

/**
 * Returns a status-specific color key for consistent theming.
 *   green  → completed / submitted
 *   gray   → expired
 *   red    → terminated
 *   yellow → missed
 *   orange → canceled
 */
export function getSessionStatusColor(status: string | null | undefined): string {
  if (!status) return "zinc";
  const normalized = status.toLowerCase();
  switch (normalized) {
    case "completed":
    case "submitted":
      return "emerald";
    case "expired":
      return "zinc";
    case "terminated":
      return "red";
    case "missed":
      return "amber";
    case "canceled":
    case "cancelled":
      return "orange";
    default:
      return "zinc";
  }
}

/**
 * Returns full Tailwind CSS class strings for a finalized status badge.
 * Designed for dark theme (zinc-950 backgrounds).
 */
export function getSessionStatusBadgeClasses(status: string | null | undefined): string {
  if (!status) return "bg-zinc-800/50 text-zinc-500 border-zinc-700/30";
  const normalized = status.toLowerCase();
  switch (normalized) {
    case "completed":
    case "submitted":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "expired":
      return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
    case "terminated":
      return "bg-red-500/10 text-red-400 border-red-500/20";
    case "missed":
      return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    case "canceled":
    case "cancelled":
      return "bg-orange-500/10 text-orange-400 border-orange-500/20";
    case "active":
    case "late_joined":
      return "bg-violet-500/10 text-violet-300 border-violet-500/20 animate-pulse";
    case "scheduled":
    case "waiting":
      return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    default:
      return "bg-zinc-800/50 text-zinc-500 border-zinc-700/30";
  }
}

/**
 * Returns the icon-appropriate message for a finalized session endpoint page.
 */
export function getSessionEndedMessage(status: string | null | undefined): string {
  if (!status) return "This interview session has ended.";
  const normalized = status.toLowerCase();
  switch (normalized) {
    case "completed":
      return "This interview has been completed successfully. Thank you for your participation.";
    case "submitted":
      return "Your assessment has been submitted and is being reviewed. Thank you for your participation.";
    case "expired":
      return "This interview session has expired. The allocated time window has elapsed.";
    case "terminated":
      return "This interview session was terminated by the proctor or administrator.";
    case "missed":
      return "This interview was missed. The candidate did not join within the scheduled window.";
    case "canceled":
    case "cancelled":
      return "This interview has been canceled by the interviewer or administrator.";
    default:
      return "This interview session has ended.";
  }
}

-- ==========================================================
-- InterviewAI Scheduling & Exam Lifecycle Migration
-- Version: 20260522143000_interview_scheduling_lifecycle
-- ==========================================================

-- 1. Add new tracking columns to public.interviews table
ALTER TABLE public.interviews
ADD COLUMN IF NOT EXISTS actual_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS actual_ended_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS join_deadline_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS candidate_joined_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS session_status TEXT DEFAULT 'scheduled' NOT NULL,
ADD COLUMN IF NOT EXISTS time_extended_minutes INTEGER DEFAULT 0 NOT NULL;

-- 2. Index the session_status column for rapid lookups and dashboards
CREATE INDEX IF NOT EXISTS idx_interviews_session_status ON public.interviews(session_status);

-- 3. Add telemetry events logging for session scheduling lifecycle overrides
-- Allow custom details structure for time extensions and proctor terminations
COMMENT ON COLUMN public.interviews.session_status IS 'Tracks proctored exam states: scheduled, waiting, active, late_joined, submitted, expired, terminated';

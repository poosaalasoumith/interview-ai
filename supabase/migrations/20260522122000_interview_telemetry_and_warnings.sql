-- ==========================================================
-- InterviewAI Proctoring & Telemetry Migration
-- ==========================================================

-- Create Telemetry table
CREATE TABLE IF NOT EXISTS public.interview_telemetry (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    interview_id UUID REFERENCES public.interviews(id) ON DELETE CASCADE NOT NULL,
    event_type TEXT NOT NULL, -- 'tab_switch', 'fullscreen_exit', 'copy_paste', 'idle', 'camera_toggle', 'microphone_toggle', 'warning_issued', 'submission'
    details JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexing for fast search and timelines
CREATE INDEX IF NOT EXISTS idx_telemetry_interview ON public.interview_telemetry(interview_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_event ON public.interview_telemetry(event_type);

-- Enable RLS
ALTER TABLE public.interview_telemetry ENABLE ROW LEVEL SECURITY;

-- Helper to check if user is participant
CREATE OR REPLACE FUNCTION public.is_interview_participant(int_id UUID, u_id UUID)
RETURNS BOOLEAN SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.interviews
    WHERE id = int_id AND (candidate_id = u_id OR interviewer_id = u_id)
  );
END;
$$ LANGUAGE plpgsql;

-- Policies
DROP POLICY IF EXISTS "Enable select access for related participants" ON public.interview_telemetry;
CREATE POLICY "Enable select access for related participants"
    ON public.interview_telemetry FOR SELECT TO authenticated
    USING (
        is_interview_participant(interview_id, auth.uid()) OR is_admin()
    );

DROP POLICY IF EXISTS "Enable insert access for all authenticated users" ON public.interview_telemetry;
CREATE POLICY "Enable insert access for all authenticated users"
    ON public.interview_telemetry FOR INSERT TO authenticated
    WITH CHECK (true);

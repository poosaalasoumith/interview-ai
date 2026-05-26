-- ==========================================================
-- Add Lifecycle, Expiration, and Proctored Timer Audit Columns
-- ==========================================================

ALTER TABLE public.interviews
ADD COLUMN IF NOT EXISTS expiration_reason TEXT,
ADD COLUMN IF NOT EXISTS status_message TEXT,
ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS remaining_seconds INTEGER;

-- Comment on audit columns to document intent
COMMENT ON COLUMN public.interviews.expiration_reason IS 'Reason why the session ended/expired (e.g. Candidate failed to enter, Technical issue, Admin terminated, etc.)';
COMMENT ON COLUMN public.interviews.status_message IS 'A human readable message describing the final lifecycle resolution state';
COMMENT ON COLUMN public.interviews.completed_by IS 'The User UUID of the participant or admin who triggered completion/termination';
COMMENT ON COLUMN public.interviews.expires_at IS 'Calculated proctored deadline timestamp set when the candidate first enters the room';
COMMENT ON COLUMN public.interviews.remaining_seconds IS 'Dynamic persisted remaining seconds count saved during candidate progression';

-- ==========================================================
-- Add Session Lock/Unlock Columns to Interviews and Restrict Candidates
-- ==========================================================

-- 1. Add Lock/Unlock Columns
ALTER TABLE public.interviews
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS unlock_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS lock_reason TEXT;

-- 2. Document Columns
COMMENT ON COLUMN public.interviews.is_locked IS 'Indicates if the candidate assessment environment is currently locked by a moderator';
COMMENT ON COLUMN public.interviews.locked_by IS 'The User UUID of the interviewer or admin who locked the session';
COMMENT ON COLUMN public.interviews.locked_at IS 'The timestamp when the session was locked';
COMMENT ON COLUMN public.interviews.unlock_at IS 'The timestamp when the session was last unlocked';
COMMENT ON COLUMN public.interviews.lock_reason IS 'The reason entered by the moderator for locking the session';

-- 3. Security Trigger Function to prevent Candidates from altering Lock Columns
CREATE OR REPLACE FUNCTION public.check_candidate_lock_update()
RETURNS TRIGGER AS $$
DECLARE
  current_user_role public.user_role;
BEGIN
  -- Get current user's role from public.users table
  SELECT role INTO current_user_role FROM public.users WHERE id = auth.uid();
  
  -- If current user is a candidate, they cannot modify lock-related fields
  IF current_user_role = 'candidate'::public.user_role THEN
    IF (NEW.is_locked IS DISTINCT FROM OLD.is_locked) OR
       (NEW.locked_by IS DISTINCT FROM OLD.locked_by) OR
       (NEW.locked_at IS DISTINCT FROM OLD.locked_at) OR
       (NEW.unlock_at IS DISTINCT FROM OLD.unlock_at) OR
       (NEW.lock_reason IS DISTINCT FROM OLD.lock_reason) THEN
      RAISE EXCEPTION 'Candidates are not authorized to modify lock status.' USING ERRCODE = '42501';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Attach BEFORE UPDATE Trigger
DROP TRIGGER IF EXISTS trigger_check_candidate_lock_update ON public.interviews;
CREATE TRIGGER trigger_check_candidate_lock_update
  BEFORE UPDATE ON public.interviews
  FOR EACH ROW
  EXECUTE PROCEDURE public.check_candidate_lock_update();

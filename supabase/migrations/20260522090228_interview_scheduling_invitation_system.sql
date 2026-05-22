-- ==========================================================
-- InterviewAI Scheduling & Invitation System Migration
-- ==========================================================

-- 1. Create Tables

-- Scheduled Interviews Table (Master Schedule)
CREATE TABLE IF NOT EXISTS public.scheduled_interviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    role_position TEXT NOT NULL,
    interview_type TEXT NOT NULL,
    difficulty_level TEXT NOT NULL,
    interviewer_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    timezone TEXT DEFAULT 'UTC' NOT NULL,
    duration_minutes INTEGER DEFAULT 60 NOT NULL,
    notes TEXT,
    room_id TEXT NOT NULL,
    status TEXT DEFAULT 'scheduled' NOT NULL,
    problem_statement JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Candidate Assignments (Links existing candidates to schedules)
CREATE TABLE IF NOT EXISTS public.candidate_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    scheduled_interview_id UUID REFERENCES public.scheduled_interviews(id) ON DELETE CASCADE NOT NULL,
    candidate_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL, -- pending, accepted, declined
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_assignment UNIQUE (scheduled_interview_id, candidate_id)
);

-- Interview Invitations (Tracks pending email invites for non-registered or registered candidates)
CREATE TABLE IF NOT EXISTS public.interview_invitations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    scheduled_interview_id UUID REFERENCES public.scheduled_interviews(id) ON DELETE CASCADE NOT NULL,
    email TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL, -- pending, accepted, expired
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    accepted_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- Interview Status Tracking (Audit log of schedule status updates)
CREATE TABLE IF NOT EXISTS public.interview_status_tracking (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    scheduled_interview_id UUID REFERENCES public.scheduled_interviews(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL,
    changed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Simulated Email Logs (Tracks mock emails for local development and verification)
CREATE TABLE IF NOT EXISTS public.email_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    to_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================================
-- 2. Performance Indexes
-- ==========================================================
CREATE INDEX IF NOT EXISTS idx_sched_int_interviewer ON public.scheduled_interviews(interviewer_id);
CREATE INDEX IF NOT EXISTS idx_sched_int_status ON public.scheduled_interviews(status);
CREATE INDEX IF NOT EXISTS idx_cand_assign_scheduled ON public.candidate_assignments(scheduled_interview_id);
CREATE INDEX IF NOT EXISTS idx_cand_assign_candidate ON public.candidate_assignments(candidate_id);
CREATE INDEX IF NOT EXISTS idx_int_inv_email ON public.interview_invitations(email);
CREATE INDEX IF NOT EXISTS idx_int_inv_token ON public.interview_invitations(token);
CREATE INDEX IF NOT EXISTS idx_email_logs_to ON public.email_logs(to_email);

-- ==========================================================
-- 3. Row Level Security (RLS) Enablement
-- ==========================================================
ALTER TABLE public.scheduled_interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_status_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- ==========================================================
-- 4. RLS Policies
-- ==========================================================

-- Helper functions to avoid infinite recursion in RLS policies (SECURITY DEFINER bypasses RLS on query)
CREATE OR REPLACE FUNCTION public.is_candidate_for_interview(interview_id UUID, user_id UUID)
RETURNS BOOLEAN SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.candidate_assignments
    WHERE scheduled_interview_id = interview_id AND candidate_id = user_id
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.is_interviewer_for_assignment(interview_id UUID, user_id UUID)
RETURNS BOOLEAN SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.scheduled_interviews
    WHERE id = interview_id AND interviewer_id = user_id
  );
END;
$$ LANGUAGE plpgsql;


-- Scheduled Interviews Policies
DROP POLICY IF EXISTS "Enable read access for related users of scheduled_interviews" ON public.scheduled_interviews;
CREATE POLICY "Enable read access for related users of scheduled_interviews" 
    ON public.scheduled_interviews FOR SELECT TO authenticated
    USING (
        auth.uid() = interviewer_id 
        OR is_admin() 
        OR is_candidate_for_interview(id, auth.uid())
    );

DROP POLICY IF EXISTS "Enable insert for interviewers and admins" ON public.scheduled_interviews;
CREATE POLICY "Enable insert for interviewers and admins" 
    ON public.scheduled_interviews FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('interviewer', 'admin'))
    );

DROP POLICY IF EXISTS "Enable update for interviewers and admins" ON public.scheduled_interviews;
CREATE POLICY "Enable update for interviewers and admins" 
    ON public.scheduled_interviews FOR UPDATE TO authenticated
    USING (
        auth.uid() = interviewer_id OR is_admin()
    );

DROP POLICY IF EXISTS "Enable delete for interviewers and admins" ON public.scheduled_interviews;
CREATE POLICY "Enable delete for interviewers and admins" 
    ON public.scheduled_interviews FOR DELETE TO authenticated
    USING (
        auth.uid() = interviewer_id OR is_admin()
    );


-- Candidate Assignments Policies
DROP POLICY IF EXISTS "Enable read for assigned candidates or schedulers" ON public.candidate_assignments;
CREATE POLICY "Enable read for assigned candidates or schedulers"
    ON public.candidate_assignments FOR SELECT TO authenticated
    USING (
        candidate_id = auth.uid()
        OR is_interviewer_for_assignment(scheduled_interview_id, auth.uid())
        OR is_admin()
    );

DROP POLICY IF EXISTS "Enable manage for schedulers" ON public.candidate_assignments;
CREATE POLICY "Enable manage for schedulers"
    ON public.candidate_assignments FOR ALL TO authenticated
    USING (
        is_interviewer_for_assignment(scheduled_interview_id, auth.uid())
        OR is_admin()
    );


-- Interview Invitations Policies
DROP POLICY IF EXISTS "Enable read for invited candidates or schedulers" ON public.interview_invitations;
CREATE POLICY "Enable read for invited candidates or schedulers"
    ON public.interview_invitations FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.scheduled_interviews si
            WHERE si.id = scheduled_interview_id AND si.interviewer_id = auth.uid()
        )
        OR is_admin()
    );

DROP POLICY IF EXISTS "Enable manage for schedulers of invitations" ON public.interview_invitations;
CREATE POLICY "Enable manage for schedulers of invitations"
    ON public.interview_invitations FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.scheduled_interviews si
            WHERE si.id = scheduled_interview_id AND si.interviewer_id = auth.uid()
        )
        OR is_admin()
    );


-- Interview Status Tracking Policies
DROP POLICY IF EXISTS "Enable read for status tracking" ON public.interview_status_tracking;
CREATE POLICY "Enable read for status tracking"
    ON public.interview_status_tracking FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.scheduled_interviews si
            WHERE si.id = scheduled_interview_id AND si.interviewer_id = auth.uid()
        )
        OR is_admin()
        OR EXISTS (
            SELECT 1 FROM public.candidate_assignments ca
            WHERE ca.scheduled_interview_id = scheduled_interview_id AND ca.candidate_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Enable manage for status tracking" ON public.interview_status_tracking;
CREATE POLICY "Enable manage for status tracking"
    ON public.interview_status_tracking FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.scheduled_interviews si
            WHERE si.id = scheduled_interview_id AND si.interviewer_id = auth.uid()
        )
        OR is_admin()
    );


-- Email Logs Policies
DROP POLICY IF EXISTS "Enable read for admins and interviewers on email_logs" ON public.email_logs;
CREATE POLICY "Enable read for admins and interviewers on email_logs"
    ON public.email_logs FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('interviewer', 'admin'))
    );

DROP POLICY IF EXISTS "Enable insert for all on email_logs" ON public.email_logs;
CREATE POLICY "Enable insert for all on email_logs"
    ON public.email_logs FOR INSERT WITH CHECK (true);

-- ==========================================================
-- 5. Trigger Functions & Database Hooks
-- ==========================================================

-- Function to handle automatic linking of pending invitations when a new user joins
CREATE OR REPLACE FUNCTION public.handle_pending_invitations()
RETURNS TRIGGER AS $$
DECLARE
  invite RECORD;
  new_interview_id UUID;
  prob_statement JSONB;
BEGIN
  -- We ONLY trigger on candidate roles
  IF NEW.role = 'candidate' THEN
    -- Check if there are pending invitations for this email
    FOR invite IN 
      SELECT * FROM public.interview_invitations 
      WHERE LOWER(email) = LOWER(NEW.email) AND status = 'pending'
    LOOP
      -- 1. Insert into candidate_assignments
      INSERT INTO public.candidate_assignments (scheduled_interview_id, candidate_id, status)
      VALUES (invite.scheduled_interview_id, NEW.id, 'accepted')
      ON CONFLICT (scheduled_interview_id, candidate_id) DO NOTHING;

      -- 2. Fetch the scheduled interview problem statement and details
      SELECT problem_statement INTO prob_statement 
      FROM public.scheduled_interviews 
      WHERE id = invite.scheduled_interview_id;

      IF prob_statement IS NULL THEN
        -- Use standard Easy default problem statement
        prob_statement := '{
          "title": "Two Sum",
          "difficulty": "Easy",
          "description": "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.",
          "examples": [
            {
              "input": "nums = [2,7,11,15], target = 9",
              "output": "[0,1]",
              "explanation": "Because nums[0] + nums[1] == 9, we return [0, 1]."
            }
          ],
          "constraints": [
            "2 <= nums.length <= 10^4",
            "-10^9 <= nums[i] <= 10^9",
            "-10^9 <= target <= 10^9",
            "Only one valid answer exists."
          ]
        }'::jsonb;
      END IF;

      -- 3. Insert into the standard public.interviews table to integrate with live system
      -- Note: Generates a new unique room for this candidate!
      new_interview_id := gen_random_uuid();
      
      INSERT INTO public.interviews (id, title, interviewer_id, candidate_id, status, problem_statement, scheduled_at)
      SELECT 
        new_interview_id,
        si.title,
        si.interviewer_id,
        NEW.id,
        'scheduled'::interview_status,
        prob_statement,
        si.scheduled_at
      FROM public.scheduled_interviews si
      WHERE si.id = invite.scheduled_interview_id;

      -- 4. Create standard interview session
      INSERT INTO public.interview_sessions (interview_id, room_id)
      VALUES (new_interview_id, new_interview_id);

      -- 5. Mark invitation as accepted
      UPDATE public.interview_invitations
      SET status = 'accepted',
          accepted_at = now(),
          accepted_by_user_id = NEW.id
      WHERE id = invite.id;

      -- 6. Log status change
      INSERT INTO public.interview_status_tracking (scheduled_interview_id, status, notes)
      VALUES (invite.scheduled_interview_id, 'accepted', 'Candidate ' || NEW.email || ' registered and accepted the interview invitation.');
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create Trigger on public.users
DROP TRIGGER IF EXISTS on_public_user_created_handle_invitations ON public.users;
CREATE TRIGGER on_public_user_created_handle_invitations
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_pending_invitations();

-- Trigger to update 'updated_at' column on scheduled_interviews
DROP TRIGGER IF EXISTS update_scheduled_interviews_updated_at ON public.scheduled_interviews;
CREATE TRIGGER update_scheduled_interviews_updated_at 
  BEFORE UPDATE ON public.scheduled_interviews 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

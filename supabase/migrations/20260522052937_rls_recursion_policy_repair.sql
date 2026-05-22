-- ==========================================================
-- 1. Helper functions to avoid infinite recursion in RLS policies (SECURITY DEFINER bypasses RLS on query)
-- ==========================================================

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

-- ==========================================================
-- 2. Repaired RLS Policies for Scheduled Interviews
-- ==========================================================

DROP POLICY IF EXISTS "Enable read access for related users of scheduled_interviews" ON public.scheduled_interviews;
CREATE POLICY "Enable read access for related users of scheduled_interviews" 
    ON public.scheduled_interviews FOR SELECT TO authenticated
    USING (
        auth.uid() = interviewer_id 
        OR is_admin() 
        OR is_candidate_for_interview(id, auth.uid())
    );

-- ==========================================================
-- 3. Repaired RLS Policies for Candidate Assignments
-- ==========================================================

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

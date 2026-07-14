-- ========================================================
-- Fix Assessment RLS Policies and Trigger Integrations
-- Version: 20260625100000_fix_assessment_policies
-- Safe, Idempotent and Non-Destructive Schema Patch
-- ========================================================

-- 1. Fix shadowed 'id' reference in Select templates policy
DROP POLICY IF EXISTS "Select templates for related users" ON public.assessment_templates;
CREATE POLICY "Select templates for related users"
    ON public.assessment_templates FOR SELECT USING (
        interviewer_id = auth.uid() 
        OR public.is_admin() 
        OR EXISTS (
            SELECT 1 FROM public.interviews i 
            WHERE i.candidate_id = auth.uid() 
              AND i.assessment_template_id = assessment_templates.id
        )
    );

-- 2. Update trigger handle_pending_invitations to copy assessment columns
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
      
      INSERT INTO public.interviews (
        id, 
        title, 
        interviewer_id, 
        candidate_id, 
        status, 
        problem_statement, 
        scheduled_at,
        assessment_source,
        assessment_template_id
      )
      SELECT 
        new_interview_id,
        si.title,
        si.interviewer_id,
        NEW.id,
        'scheduled'::interview_status,
        CASE WHEN si.assessment_source = 'uploaded' THEN NULL ELSE prob_statement END,
        si.scheduled_at,
        si.assessment_source,
        si.assessment_template_id
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

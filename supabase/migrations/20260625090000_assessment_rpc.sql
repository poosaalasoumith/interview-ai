-- ========================================================
-- InterviewAI Custom Assessment RPC Functions
-- Version: 20260625090000_assessment_rpc
-- Security Definer functions to securely run DDL/DML for candidates
-- ========================================================

-- Secure RPC to retrieve ALL test cases (both visible and hidden) for evaluation
CREATE OR REPLACE FUNCTION public.get_testcases_for_evaluation(q_id UUID)
RETURNS TABLE (
  id UUID,
  input TEXT,
  expected_output TEXT,
  is_hidden BOOLEAN,
  time_limit_ms INTEGER,
  memory_limit_kb INTEGER
) SECURITY DEFINER AS $$
BEGIN
  -- Enforce authorization: user must be the interviewer, admin, or the candidate assigned to the interview containing this question
  IF EXISTS (
    SELECT 1 FROM public.assessment_questions q
    JOIN public.assessment_templates t ON q.template_id = t.id
    LEFT JOIN public.interviews i ON i.assessment_template_id = t.id
    WHERE q.id = q_id AND (
      t.interviewer_id = auth.uid()
      OR public.is_admin()
      OR i.candidate_id = auth.uid()
    )
  ) THEN
    RETURN QUERY 
    SELECT qt.id, qt.input, qt.expected_output, qt.is_hidden, qt.time_limit_ms, qt.memory_limit_kb
    FROM public.question_testcases qt
    WHERE qt.question_id = q_id;
  ELSE
    RAISE EXCEPTION 'Unauthorized to retrieve test cases for this question';
  END IF;
END;
$$ LANGUAGE plpgsql;

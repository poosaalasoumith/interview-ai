-- ==========================================================
-- Allow Candidates to update their own interviews
-- ==========================================================

CREATE POLICY "Candidates can update their own interviews"
ON public.interviews 
FOR UPDATE 
TO authenticated
USING (auth.uid() = candidate_id)
WITH CHECK (auth.uid() = candidate_id);

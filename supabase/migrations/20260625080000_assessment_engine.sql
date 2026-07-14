-- ========================================================
-- InterviewAI Custom Assessment Engine Setup
-- Version: 20260625080000_assessment_engine
-- Safe, Idempotent and Non-Destructive Database Setup
-- ========================================================

-- 1. Create the 'assessments' storage bucket if it does not exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'assessments', 
  'assessments', 
  false, -- private bucket
  10485760, -- 10MB limit
  ARRAY[
    'application/pdf', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', -- docx
    'text/markdown', 
    'text/plain'
  ]::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies for the 'assessments' bucket
DROP POLICY IF EXISTS "Interviewers and Admins manage assessments" ON storage.objects;
CREATE POLICY "Interviewers and Admins manage assessments" 
  ON storage.objects FOR ALL 
  TO authenticated 
  USING (bucket_id = 'assessments')
  WITH CHECK (bucket_id = 'assessments');

DROP POLICY IF EXISTS "Candidates read assessments" ON storage.objects;
CREATE POLICY "Candidates read assessments" 
  ON storage.objects FOR SELECT 
  TO authenticated 
  USING (bucket_id = 'assessments');

-- 2. Table Definitions

-- Assessment Documents Table
CREATE TABLE IF NOT EXISTS public.assessment_documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    interviewer_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    status TEXT DEFAULT 'processing' NOT NULL, -- processing, parsed, failed
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Assessment Templates Table
CREATE TABLE IF NOT EXISTS public.assessment_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    interviewer_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    document_id UUID REFERENCES public.assessment_documents(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Assessment Questions Table
CREATE TABLE IF NOT EXISTS public.assessment_questions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    template_id UUID REFERENCES public.assessment_templates(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    difficulty TEXT DEFAULT 'Medium' NOT NULL,
    constraints JSONB DEFAULT '[]'::jsonb NOT NULL,
    examples JSONB DEFAULT '[]'::jsonb NOT NULL,
    starter_code JSONB DEFAULT '{}'::jsonb NOT NULL,
    expected_language TEXT,
    marks INTEGER DEFAULT 10 NOT NULL,
    tags JSONB DEFAULT '[]'::jsonb NOT NULL,
    order_index INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Question Testcases Table
CREATE TABLE IF NOT EXISTS public.question_testcases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    question_id UUID REFERENCES public.assessment_questions(id) ON DELETE CASCADE NOT NULL,
    input TEXT NOT NULL,
    expected_output TEXT NOT NULL,
    is_hidden BOOLEAN DEFAULT false NOT NULL,
    explanation TEXT,
    time_limit_ms INTEGER DEFAULT 3000 NOT NULL,
    memory_limit_kb INTEGER DEFAULT 262144 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Assessment Attempts Table
CREATE TABLE IF NOT EXISTS public.assessment_attempts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    interview_id UUID REFERENCES public.interviews(id) ON DELETE CASCADE NOT NULL UNIQUE,
    candidate_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    template_id UUID REFERENCES public.assessment_templates(id) ON DELETE CASCADE NOT NULL,
    status TEXT DEFAULT 'in_progress' NOT NULL, -- in_progress, completed
    started_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Candidate Answers Table
CREATE TABLE IF NOT EXISTS public.candidate_answers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    attempt_id UUID REFERENCES public.assessment_attempts(id) ON DELETE CASCADE NOT NULL,
    question_id UUID REFERENCES public.assessment_questions(id) ON DELETE CASCADE NOT NULL,
    code TEXT NOT NULL,
    language TEXT NOT NULL,
    status TEXT DEFAULT 'not_started' NOT NULL, -- not_started, in_progress, solved, submitted, skipped
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_attempt_question UNIQUE (attempt_id, question_id)
);

-- Execution Results Table
CREATE TABLE IF NOT EXISTS public.execution_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    candidate_answer_id UUID REFERENCES public.candidate_answers(id) ON DELETE CASCADE NOT NULL,
    testcase_id UUID REFERENCES public.question_testcases(id) ON DELETE CASCADE NOT NULL,
    passed BOOLEAN NOT NULL,
    stdout TEXT,
    stderr TEXT,
    runtime_status TEXT NOT NULL, -- Passed, Failed, Wrong Answer, Time Limit Exceeded, Compilation Error, Runtime Error
    execution_time_ms INTEGER,
    memory_used_kb INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_answer_testcase UNIQUE (candidate_answer_id, testcase_id)
);

-- Assessment Scores Table (Question-wise evaluation & AI feedback)
CREATE TABLE IF NOT EXISTS public.assessment_scores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    attempt_id UUID REFERENCES public.assessment_attempts(id) ON DELETE CASCADE NOT NULL,
    question_id UUID REFERENCES public.assessment_questions(id) ON DELETE CASCADE NOT NULL,
    score INTEGER DEFAULT 0 NOT NULL,
    ai_evaluation JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_attempt_question_score UNIQUE (attempt_id, question_id)
);

-- 3. Schema Alterations for Interviews & Schedules
ALTER TABLE public.interviews 
ADD COLUMN IF NOT EXISTS assessment_source TEXT DEFAULT 'ai_generated',
ADD COLUMN IF NOT EXISTS assessment_template_id UUID REFERENCES public.assessment_templates(id) ON DELETE SET NULL;

ALTER TABLE public.scheduled_interviews 
ADD COLUMN IF NOT EXISTS assessment_source TEXT DEFAULT 'ai_generated',
ADD COLUMN IF NOT EXISTS assessment_template_id UUID REFERENCES public.assessment_templates(id) ON DELETE SET NULL;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.assessment_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_testcases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_scores ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies

-- A. Assessment Documents Policies
DROP POLICY IF EXISTS "Interviewer and Admin manage docs" ON public.assessment_documents;
CREATE POLICY "Interviewer and Admin manage docs"
    ON public.assessment_documents FOR ALL USING (interviewer_id = auth.uid() OR public.is_admin());

-- B. Assessment Templates Policies
DROP POLICY IF EXISTS "Select templates for related users" ON public.assessment_templates;
CREATE POLICY "Select templates for related users"
    ON public.assessment_templates FOR SELECT USING (
        interviewer_id = auth.uid() 
        OR public.is_admin() 
        OR EXISTS (SELECT 1 FROM public.interviews i WHERE i.candidate_id = auth.uid() AND i.assessment_template_id = id)
    );

DROP POLICY IF EXISTS "Manage templates for interviewers" ON public.assessment_templates;
CREATE POLICY "Manage templates for interviewers"
    ON public.assessment_templates FOR ALL USING (interviewer_id = auth.uid() OR public.is_admin());

-- C. Assessment Questions Policies
DROP POLICY IF EXISTS "Select questions for related users" ON public.assessment_questions;
CREATE POLICY "Select questions for related users"
    ON public.assessment_questions FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.assessment_templates t 
            WHERE t.id = template_id AND (
                t.interviewer_id = auth.uid() 
                OR public.is_admin() 
                OR EXISTS (SELECT 1 FROM public.interviews i WHERE i.candidate_id = auth.uid() AND i.assessment_template_id = t.id)
            )
        )
    );

DROP POLICY IF EXISTS "Manage questions for interviewers" ON public.assessment_questions;
CREATE POLICY "Manage questions for interviewers"
    ON public.assessment_questions FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.assessment_templates t 
            WHERE t.id = template_id AND (t.interviewer_id = auth.uid() OR public.is_admin())
        )
    );

-- D. Question Testcases Policies (Restricts hidden test cases from candidates!)
DROP POLICY IF EXISTS "Select testcases for related users" ON public.question_testcases;
CREATE POLICY "Select testcases for related users"
    ON public.question_testcases FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.assessment_questions q
            JOIN public.assessment_templates t ON q.template_id = t.id
            WHERE q.id = question_id AND (
                t.interviewer_id = auth.uid() 
                OR public.is_admin() 
                -- Candidate can ONLY select visible testcases
                OR (EXISTS (SELECT 1 FROM public.interviews i WHERE i.candidate_id = auth.uid() AND i.assessment_template_id = t.id) AND is_hidden = false)
            )
        )
    );

DROP POLICY IF EXISTS "Manage testcases for interviewers" ON public.question_testcases;
CREATE POLICY "Manage testcases for interviewers"
    ON public.question_testcases FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.assessment_questions q
            JOIN public.assessment_templates t ON q.template_id = t.id
            WHERE q.id = question_id AND (t.interviewer_id = auth.uid() OR public.is_admin())
        )
    );

-- E. Assessment Attempts Policies
DROP POLICY IF EXISTS "Select attempts for related users" ON public.assessment_attempts;
CREATE POLICY "Select attempts for related users"
    ON public.assessment_attempts FOR SELECT USING (
        candidate_id = auth.uid()
        OR public.is_admin()
        OR EXISTS (SELECT 1 FROM public.interviews i WHERE i.id = interview_id AND i.interviewer_id = auth.uid())
    );

DROP POLICY IF EXISTS "Manage attempts for candidates and interviewers" ON public.assessment_attempts;
CREATE POLICY "Manage attempts for candidates and interviewers"
    ON public.assessment_attempts FOR ALL USING (
        candidate_id = auth.uid()
        OR public.is_admin()
        OR EXISTS (SELECT 1 FROM public.interviews i WHERE i.id = interview_id AND i.interviewer_id = auth.uid())
    );

-- F. Candidate Answers Policies
DROP POLICY IF EXISTS "Select candidate answers for related users" ON public.candidate_answers;
CREATE POLICY "Select candidate answers for related users"
    ON public.candidate_answers FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.assessment_attempts a
            WHERE a.id = attempt_id AND (
                a.candidate_id = auth.uid()
                OR public.is_admin()
                -- Interviewer can review candidate answers
                OR EXISTS (SELECT 1 FROM public.interviews i WHERE i.id = a.interview_id AND i.interviewer_id = auth.uid())
            )
        )
    );

DROP POLICY IF EXISTS "Manage candidate answers for candidate" ON public.candidate_answers;
CREATE POLICY "Manage candidate answers for candidate"
    ON public.candidate_answers FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.assessment_attempts a
            WHERE a.id = attempt_id AND (a.candidate_id = auth.uid() OR public.is_admin())
        )
    );

-- G. Execution Results Policies
DROP POLICY IF EXISTS "Select execution results for related users" ON public.execution_results;
CREATE POLICY "Select execution results for related users"
    ON public.execution_results FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.candidate_answers ans
            JOIN public.assessment_attempts a ON ans.attempt_id = a.id
            WHERE ans.id = candidate_answer_id AND (
                a.candidate_id = auth.uid()
                OR public.is_admin()
                OR EXISTS (SELECT 1 FROM public.interviews i WHERE i.id = a.interview_id AND i.interviewer_id = auth.uid())
            )
        )
    );

DROP POLICY IF EXISTS "Manage execution results for candidate" ON public.execution_results;
CREATE POLICY "Manage execution results for candidate"
    ON public.execution_results FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.candidate_answers ans
            JOIN public.assessment_attempts a ON ans.attempt_id = a.id
            WHERE ans.id = candidate_answer_id AND (a.candidate_id = auth.uid() OR public.is_admin())
        )
    );

-- H. Assessment Scores Policies (Restricted to interviewers/admins and candidates with no AI details)
DROP POLICY IF EXISTS "Select scores for related users" ON public.assessment_scores;
CREATE POLICY "Select scores for related users"
    ON public.assessment_scores FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.assessment_attempts a
            WHERE a.id = attempt_id AND (
                a.candidate_id = auth.uid()
                OR public.is_admin()
                OR EXISTS (SELECT 1 FROM public.interviews i WHERE i.id = a.interview_id AND i.interviewer_id = auth.uid())
            )
        )
    );

DROP POLICY IF EXISTS "Manage scores for interviewers and admins" ON public.assessment_scores;
CREATE POLICY "Manage scores for interviewers and admins"
    ON public.assessment_scores FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.assessment_attempts a
            WHERE a.id = attempt_id AND (
                public.is_admin() 
                OR EXISTS (SELECT 1 FROM public.interviews i WHERE i.id = a.interview_id AND i.interviewer_id = auth.uid())
            )
        )
    );

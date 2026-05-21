-- ==========================================
-- InterviewAI Supabase Database Schema
-- ==========================================

-- 1. Custom Types & Enums
CREATE TYPE user_role AS ENUM ('candidate', 'interviewer', 'admin');
CREATE TYPE interview_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');
CREATE TYPE programming_language AS ENUM ('javascript', 'python', 'java', 'cpp', 'typescript');

-- ==========================================
-- 2. Table Definitions
-- ==========================================

-- Users Table (Extends Supabase auth.users)
CREATE TABLE public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    role user_role DEFAULT 'candidate'::user_role NOT NULL,
    name TEXT,
    email TEXT UNIQUE NOT NULL,
    avatar TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Interviews Table
CREATE TABLE public.interviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    interviewer_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    candidate_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    status interview_status DEFAULT 'scheduled'::interview_status NOT NULL,
    problem_statement JSONB,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT different_users CHECK (interviewer_id != candidate_id)
);

-- Interview Sessions Table (Real-time video metadata)
CREATE TABLE public.interview_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    interview_id UUID REFERENCES public.interviews(id) ON DELETE CASCADE NOT NULL UNIQUE,
    room_id TEXT NOT NULL UNIQUE,
    duration_minutes INTEGER,
    recording_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE
);

-- Submissions Table
CREATE TABLE public.submissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    interview_id UUID REFERENCES public.interviews(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    language TEXT NOT NULL,
    code TEXT NOT NULL,
    output TEXT,
    status TEXT,
    execution_time NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Feedback Table
CREATE TABLE public.feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    interview_id UUID REFERENCES public.interviews(id) ON DELETE CASCADE NOT NULL UNIQUE,
    interviewer_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    candidate_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    technical_score INTEGER CHECK (technical_score >= 0 AND technical_score <= 100),
    communication_score INTEGER CHECK (communication_score >= 0 AND communication_score <= 100),
    overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
    ai_feedback TEXT,
    interviewer_comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Analytics Table
CREATE TABLE public.analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    total_interviews INTEGER DEFAULT 0,
    completed_interviews INTEGER DEFAULT 0,
    average_score NUMERIC(5,2) DEFAULT 0.00,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 3. Indexes for Performance Optimization
-- ==========================================

CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_interviews_candidate_id ON public.interviews(candidate_id);
CREATE INDEX idx_interviews_interviewer_id ON public.interviews(interviewer_id);
CREATE INDEX idx_interviews_status ON public.interviews(status);
CREATE INDEX idx_submissions_interview_id ON public.submissions(interview_id);
CREATE INDEX idx_feedback_candidate_id ON public.feedback(candidate_id);

-- ==========================================
-- 4. Row Level Security (RLS) Configuration
-- ==========================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics ENABLE ROW LEVEL SECURITY;

-- Utility Function to Check if User is Admin
CREATE OR REPLACE FUNCTION is_admin() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 5. RLS Policies
-- ==========================================

-- Users Policies
CREATE POLICY "Enable read access for all authenticated users" 
    ON public.users FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update their own profile" 
    ON public.users FOR UPDATE USING (auth.uid() = id);

-- Interviews Policies
CREATE POLICY "Users can view their own interviews" 
    ON public.interviews FOR SELECT USING (auth.uid() = candidate_id OR auth.uid() = interviewer_id OR is_admin());

CREATE POLICY "Interviewers and Admins can create interviews" 
    ON public.interviews FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('interviewer', 'admin'))
    );

CREATE POLICY "Interviewers can update their own interviews" 
    ON public.interviews FOR UPDATE USING (auth.uid() = interviewer_id OR is_admin());

-- Interview Sessions Policies
CREATE POLICY "Participants can view their interview sessions" 
    ON public.interview_sessions FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.interviews 
            WHERE interviews.id = interview_sessions.interview_id 
            AND (interviews.candidate_id = auth.uid() OR interviews.interviewer_id = auth.uid())
        ) OR is_admin()
    );

CREATE POLICY "Interviewers can manage interview sessions" 
    ON public.interview_sessions FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.interviews 
            WHERE interviews.id = interview_sessions.interview_id 
            AND interviews.interviewer_id = auth.uid()
        ) OR is_admin()
    );

-- Submissions Policies
CREATE POLICY "Participants can view submissions for their sessions" 
    ON public.submissions FOR SELECT USING (
        user_id = auth.uid() OR 
        EXISTS (
            SELECT 1 FROM public.interviews i
            WHERE i.id = submissions.interview_id AND (i.interviewer_id = auth.uid() OR i.candidate_id = auth.uid())
        ) OR is_admin()
    );

CREATE POLICY "Candidates can insert their own submissions" 
    ON public.submissions FOR INSERT WITH CHECK (user_id = auth.uid());

-- Feedback Policies
CREATE POLICY "Candidates can view their own feedback" 
    ON public.feedback FOR SELECT USING (candidate_id = auth.uid() OR interviewer_id = auth.uid() OR is_admin());

CREATE POLICY "Interviewers can create feedback for their candidates" 
    ON public.feedback FOR INSERT WITH CHECK (interviewer_id = auth.uid());

CREATE POLICY "Interviewers can update their own feedback" 
    ON public.feedback FOR UPDATE USING (interviewer_id = auth.uid() OR is_admin());

-- Analytics Policies
CREATE POLICY "Users can view their own analytics" 
    ON public.analytics FOR SELECT USING (user_id = auth.uid() OR is_admin());

-- ==========================================
-- 6. Database Triggers
-- ==========================================

-- Trigger to automatically create a user profile when they sign up in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatar, role)
  VALUES (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    COALESCE((new.raw_user_meta_data->>'role')::user_role, 'candidate'::user_role)
  );
  
  -- Initialize analytics for the new user
  INSERT INTO public.analytics (user_id) VALUES (new.id);
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Trigger to update 'updated_at' column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_interviews_updated_at BEFORE UPDATE ON public.interviews FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ==========================================
-- 7. Analytics Sync Triggers
-- ==========================================

-- Function to update candidate analytics when feedback is inserted or updated
CREATE OR REPLACE FUNCTION public.handle_feedback_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.analytics (user_id, total_interviews, completed_interviews, average_score, last_updated)
  VALUES (
    NEW.candidate_id,
    (SELECT COUNT(*) FROM public.interviews WHERE candidate_id = NEW.candidate_id),
    (SELECT COUNT(*) FROM public.feedback WHERE candidate_id = NEW.candidate_id),
    COALESCE((SELECT AVG(overall_score)::NUMERIC(5,2) FROM public.feedback WHERE candidate_id = NEW.candidate_id), 0.00),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_interviews = (SELECT COUNT(*) FROM public.interviews WHERE candidate_id = EXCLUDED.user_id),
    completed_interviews = (SELECT COUNT(*) FROM public.feedback WHERE candidate_id = EXCLUDED.user_id),
    average_score = COALESCE((SELECT AVG(overall_score)::NUMERIC(5,2) FROM public.feedback WHERE candidate_id = EXCLUDED.user_id), 0.00),
    last_updated = now();
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_feedback_inserted_or_updated
  AFTER INSERT OR UPDATE ON public.feedback
  FOR EACH ROW EXECUTE PROCEDURE public.handle_feedback_changes();

-- Function to update candidate analytics total interviews count when interview is scheduled or deleted
CREATE OR REPLACE FUNCTION public.handle_interview_changes()
RETURNS TRIGGER AS $$
DECLARE
  cand_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    cand_id := OLD.candidate_id;
  ELSE
    cand_id := NEW.candidate_id;
  END IF;

  INSERT INTO public.analytics (user_id, total_interviews, last_updated)
  VALUES (
    cand_id,
    (SELECT COUNT(*) FROM public.interviews WHERE candidate_id = cand_id),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_interviews = (SELECT COUNT(*) FROM public.interviews WHERE candidate_id = cand_id),
    last_updated = now();

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_interview_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.interviews
  FOR EACH ROW EXECUTE PROCEDURE public.handle_interview_changes();

-- ==========================================
-- Migration: 20260627120000_practice_interviews
-- Description: Create practice_interviews table for dynamic mock evaluation tracing
-- ==========================================

CREATE TABLE IF NOT EXISTS public.practice_interviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    round TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    personality TEXT NOT NULL,
    questions JSONB NOT NULL,
    chat_log JSONB NOT NULL,
    evaluation JSONB,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'completed', 'failed'
    error_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.practice_interviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Allow public insert for anonymous/candidate runs" ON public.practice_interviews;
CREATE POLICY "Allow public insert for anonymous/candidate runs" 
ON public.practice_interviews 
FOR INSERT 
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow users to read their own practice runs" ON public.practice_interviews;
CREATE POLICY "Allow users to read their own practice runs" 
ON public.practice_interviews 
FOR SELECT 
USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Allow users to update their own practice runs" ON public.practice_interviews;
CREATE POLICY "Allow users to update their own practice runs" 
ON public.practice_interviews 
FOR UPDATE 
USING (auth.uid() = user_id OR user_id IS NULL);

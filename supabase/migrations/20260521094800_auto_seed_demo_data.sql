
-- Replicate seed accounts inside auth.users so that they satisfy foreign key constraints
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
VALUES 
  ('00000000-0000-0000-0000-000000000002', 'sarah.jenkins@interviewai.demo', '$2a$10$w09ZkHw3mH67F37d1rQn/uxT/L67m7eSdf6zK3812dskxSj67xNn.', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Sarah Jenkins","role":"interviewer","avatar_url":"https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"}', now(), now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000004', 'marcus.vance@interviewai.demo', '$2a$10$w09ZkHw3mH67F37d1rQn/uxT/L67m7eSdf6zK3812dskxSj67xNn.', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Marcus Vance","role":"interviewer","avatar_url":"https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"}', now(), now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000003', 'sophia.chen@interviewai.demo', '$2a$10$w09ZkHw3mH67F37d1rQn/uxT/L67m7eSdf6zK3812dskxSj67xNn.', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Sophia Chen","role":"candidate","avatar_url":"https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"}', now(), now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000005', 'liam.oconnor@interviewai.demo', '$2a$10$w09ZkHw3mH67F37d1rQn/uxT/L67m7eSdf6zK3812dskxSj67xNn.', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Liam O''Connor","role":"candidate","avatar_url":"https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"}', now(), now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000001', 'admin@interviewai.demo', '$2a$10$w09ZkHw3mH67F37d1rQn/uxT/L67m7eSdf6zK3812dskxSj67xNn.', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Admin Console","role":"admin","avatar_url":"https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"}', now(), now(), 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

-- Replicate seed accounts inside public.users to ensure immediate availability and roles
INSERT INTO public.users (id, role, name, email, avatar)
VALUES
  ('00000000-0000-0000-0000-000000000002', 'interviewer'::public.user_role, 'Sarah Jenkins', 'sarah.jenkins@interviewai.demo', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'),
  ('00000000-0000-0000-0000-000000000004', 'interviewer'::public.user_role, 'Marcus Vance', 'marcus.vance@interviewai.demo', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'),
  ('00000000-0000-0000-0000-000000000003', 'candidate'::public.user_role, 'Sophia Chen', 'sophia.chen@interviewai.demo', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'),
  ('00000000-0000-0000-0000-000000000005', 'candidate'::public.user_role, 'Liam O''Connor', 'liam.oconnor@interviewai.demo', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'),
  ('00000000-0000-0000-0000-000000000001', 'admin'::public.user_role, 'Admin Console', 'admin@interviewai.demo', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80')
ON CONFLICT (id) DO NOTHING;

-- Trigger Function to Automatically Seed Mock Accounts on Sign-Up
CREATE OR REPLACE FUNCTION public.auto_seed_user_data()
RETURNS trigger AS $$
DECLARE
  new_user_role public.user_role;
  new_user_name TEXT;
  mock_interviewer_1 UUID := '00000000-0000-0000-0000-000000000002';
  mock_interviewer_2 UUID := '00000000-0000-0000-0000-000000000004';
  mock_candidate_1 UUID := '00000000-0000-0000-0000-000000000003';
  mock_candidate_2 UUID := '00000000-0000-0000-0000-000000000005';
  
  int_id_1 UUID;
  int_id_2 UUID;
  int_id_3 UUID;
  int_id_4 UUID;
BEGIN
  new_user_role := NEW.role;
  new_user_name := COALESCE(NEW.name, 'User');
  
  -- Prevent triggers on system seed accounts from causing duplicate recursion
  -- We only seed for real users or initial bootstrapped user inserts
  
  -- Ensure dependencies (mock profiles) exist first
  INSERT INTO public.users (id, role, name, email, avatar)
  VALUES (
    mock_interviewer_1,
    'interviewer'::public.user_role,
    'Sarah Jenkins',
    'sarah.jenkins@interviewai.demo',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.users (id, role, name, email, avatar)
  VALUES (
    mock_interviewer_2,
    'interviewer'::public.user_role,
    'Marcus Vance',
    'marcus.vance@interviewai.demo',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.users (id, role, name, email, avatar)
  VALUES (
    mock_candidate_1,
    'candidate'::public.user_role,
    'Sophia Chen',
    'sophia.chen@interviewai.demo',
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.users (id, role, name, email, avatar)
  VALUES (
    mock_candidate_2,
    'candidate'::public.user_role,
    'Liam O''Connor',
    'liam.oconnor@interviewai.demo',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'
  ) ON CONFLICT (id) DO NOTHING;

  -- ----------------------------------------------------
  -- CASE A: User is a CANDIDATE
  -- ----------------------------------------------------
  IF new_user_role = 'candidate' AND NEW.id NOT IN (mock_candidate_1, mock_candidate_2) THEN
    
    -- 1. Create Past Completed Interviews
    -- Interview 1 (Python Screen - Two Sum)
    int_id_1 := gen_random_uuid();
    INSERT INTO public.interviews (id, title, interviewer_id, candidate_id, status, problem_statement, scheduled_at)
    VALUES (
      int_id_1,
      'Python Technical Screening - Arrays & Hashing',
      mock_interviewer_1,
      NEW.id,
      'completed'::public.interview_status,
      '{"title": "Two Sum", "difficulty": "Easy", "description": "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target."}'::JSONB,
      now() - INTERVAL '5 days'
    );

    -- Interview 2 (JS Logic - Valid Parentheses)
    int_id_2 := gen_random_uuid();
    INSERT INTO public.interviews (id, title, interviewer_id, candidate_id, status, problem_statement, scheduled_at)
    VALUES (
      int_id_2,
      'JavaScript Core Competency - Stacks & Strings',
      mock_interviewer_2,
      NEW.id,
      'completed'::public.interview_status,
      '{"title": "Valid Parentheses", "difficulty": "Easy", "description": "Given a string s containing just the characters ''('', '')'', ''{'', ''}'', ''['' and '']'', determine if the input string is valid."}'::JSONB,
      now() - INTERVAL '2 days'
    );

    -- Interview 3 (Data Struct - Merge Intervals)
    int_id_3 := gen_random_uuid();
    INSERT INTO public.interviews (id, title, interviewer_id, candidate_id, status, problem_statement, scheduled_at)
    VALUES (
      int_id_3,
      'Systems Architect Round - Sorting & Intervals',
      mock_interviewer_1,
      NEW.id,
      'completed'::public.interview_status,
      '{"title": "Merge Intervals", "difficulty": "Medium", "description": "Given an array of intervals where intervals[i] = [start_i, end_i], merge all overlapping intervals."}'::JSONB,
      now() - INTERVAL '1 day'
    );

    -- 2. Seed Monaco Coding Submissions
    -- Submission 1
    INSERT INTO public.submissions (interview_id, user_id, language, code, output, status, execution_time)
    VALUES (
      int_id_1,
      NEW.id,
      'python',
      'def twoSum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        diff = target - num
        if diff in seen:
            return [seen[diff], i]
        seen[num] = i
    return []',
      '[0, 1]',
      'success',
      0.045
    );

    -- Submission 2
    INSERT INTO public.submissions (interview_id, user_id, language, code, output, status, execution_time)
    VALUES (
      int_id_2,
      NEW.id,
      'javascript',
      'function isValid(s) {
    const stack = [];
    const mapping = {
        ")": "(",
        "}": "{",
        "]": "["
    };
    for (let char of s) {
        if (char in mapping) {
            const topElement = stack.length === 0 ? "#" : stack.pop();
            if (topElement !== mapping[char]) {
                return false;
            }
        } else {
            stack.push(char);
        }
    }
    return stack.length === 0;
}',
      'true',
      'success',
      0.032
    );

    -- Submission 3
    INSERT INTO public.submissions (interview_id, user_id, language, code, output, status, execution_time)
    VALUES (
      int_id_3,
      NEW.id,
      'python',
      'def merge(intervals):
    intervals.sort(key=lambda x: x[0])
    merged = []
    for interval in intervals:
        if not merged or merged[-1][1] < interval[0]:
            merged.append(interval)
        else:
            merged[-1][1] = max(merged[-1][1], interval[1])
    return merged',
      '[[1, 6], [8, 10], [15, 18]]',
      'success',
      0.089
    );

    -- 3. Seed Interviewer Reviews & AI Code Reviews
    -- Report 1
    INSERT INTO public.feedback (interview_id, interviewer_id, candidate_id, technical_score, communication_score, overall_score, ai_feedback, interviewer_comments)
    VALUES (
      int_id_1,
      mock_interviewer_1,
      NEW.id,
      90,
      85,
      88,
      '### AI Evaluation Report
**Overview**: The candidate demonstrated a strong command of linear array parsing and hashing strategies.
**Strengths**:
- Optimal time complexity implementation of O(N) using a single-pass hash map.
- Clean memory management and concise variable naming.
**Areas of Improvement**:
- Could add robust type annotations or input checking to ensure the parameter type is restricted.',
      'Excellent problem-solving methodology. Sophia explained her thoughts clearly while building the hash map optimization. Top-tier candidate.'
    );

    -- Report 2
    INSERT INTO public.feedback (interview_id, interviewer_id, candidate_id, technical_score, communication_score, overall_score, ai_feedback, interviewer_comments)
    VALUES (
      int_id_2,
      mock_interviewer_2,
      NEW.id,
      85,
      80,
      83,
      '### AI Evaluation Report
**Overview**: The candidate successfully used a standard stack datastructure to solve the parenthesis matching problem.
**Strengths**:
- Handled empty string edge-cases correctly.
- Used a lookup map to separate parenthesis characters elegantly.
**Areas of Improvement**:
- Mentioning alternative data structures like trees or queues to discuss matching limits in distributed systems.',
      'Very solid coding speed. Finished within 15 minutes. Addressed all syntax questions with ease.'
    );

    -- Report 3
    INSERT INTO public.feedback (interview_id, interviewer_id, candidate_id, technical_score, communication_score, overall_score, ai_feedback, interviewer_comments)
    VALUES (
      int_id_3,
      mock_interviewer_1,
      NEW.id,
      95,
      90,
      93,
      '### AI Evaluation Report
**Overview**: Excellent grasp of sorting algorithms and greedy intervals processing.
**Strengths**:
- Flawless in-place comparisons and boundary adjustments.
- Highly proactive communication during coding.
**Areas of Improvement**:
- Consider talking about the space complexity trade-offs between creating a new array versus sorting in-place.',
      'Outstanding performance. Handled a tough intervals question effortlessly. Perfect communication skills.'
    );

    -- 4. Seed Upcoming Interviews
    INSERT INTO public.interviews (title, interviewer_id, candidate_id, status, problem_statement, scheduled_at)
    VALUES (
      'System Architecture Review - High Load Systems',
      mock_interviewer_2,
      NEW.id,
      'scheduled'::public.interview_status,
      '{"title": "LRU Cache", "difficulty": "Hard", "description": "Design a data structure that follows the constraints of a Least Recently Used (LRU) cache."}'::JSONB,
      now() + INTERVAL '1 day' + INTERVAL '4 hours'
    );

    INSERT INTO public.interviews (title, interviewer_id, candidate_id, status, problem_statement, scheduled_at)
    VALUES (
      'Gemini Advanced AI Session - Live AI Integration',
      mock_interviewer_1,
      NEW.id,
      'scheduled'::public.interview_status,
      '{"title": "Binary Tree Maximum Path Sum", "difficulty": "Hard", "description": "Given a non-empty binary tree, find the maximum path sum."}'::JSONB,
      now() + INTERVAL '5 days' + INTERVAL '1 hour'
    );

    -- 5. Establish Dynamic Cache Analytics
    INSERT INTO public.analytics (user_id, total_interviews, completed_interviews, average_score, last_updated)
    VALUES (
      NEW.id,
      5,
      3,
      88.00,
      now()
    ) ON CONFLICT (user_id) DO UPDATE SET
      total_interviews = 5,
      completed_interviews = 3,
      average_score = 88.00,
      last_updated = now();

  -- ----------------------------------------------------
  -- CASE B: User is an INTERVIEWER
  -- ----------------------------------------------------
  ELSIF new_user_role = 'interviewer' AND NEW.id NOT IN (mock_interviewer_1, mock_interviewer_2) THEN
    
    -- 1. Create Past Completed Interviews
    int_id_1 := gen_random_uuid();
    INSERT INTO public.interviews (id, title, interviewer_id, candidate_id, status, problem_statement, scheduled_at)
    VALUES (
      int_id_1,
      'Python Technical Screening - Arrays & Hashing',
      NEW.id,
      mock_candidate_1,
      'completed'::public.interview_status,
      '{"title": "Two Sum", "difficulty": "Easy", "description": "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target."}'::JSONB,
      now() - INTERVAL '4 days'
    );

    int_id_2 := gen_random_uuid();
    INSERT INTO public.interviews (id, title, interviewer_id, candidate_id, status, problem_statement, scheduled_at)
    VALUES (
      int_id_2,
      'JavaScript Core Competency - Stacks & Strings',
      NEW.id,
      mock_candidate_2,
      'completed'::public.interview_status,
      '{"title": "Valid Parentheses", "difficulty": "Easy", "description": "Given a string s containing just the characters ''('', '')'', ''{'', ''}'', ''['' and '']'', determine if the input string is valid."}'::JSONB,
      now() - INTERVAL '2 days'
    );

    -- 2. Seed Feedback Reviews
    INSERT INTO public.feedback (interview_id, interviewer_id, candidate_id, technical_score, communication_score, overall_score, ai_feedback, interviewer_comments)
    VALUES (
      int_id_1,
      NEW.id,
      mock_candidate_1,
      92,
      88,
      90,
      '### AI Evaluation Report
**Overview**: The candidate Sophia Chen demonstrated robust algorithmic efficiency.
**Strengths**:
- Single-pass hash map implementation.
- Exceptionally clear code readability.',
      'Excellent problem-solving session. Highly recommended for the next architectural round.'
    );

    INSERT INTO public.feedback (interview_id, interviewer_id, candidate_id, technical_score, communication_score, overall_score, ai_feedback, interviewer_comments)
    VALUES (
      int_id_2,
      NEW.id,
      mock_candidate_2,
      82,
      78,
      80,
      '### AI Evaluation Report
**Overview**: The candidate Liam O''Connor solved the valid parentheses problem in linear time.
**Strengths**:
- Accurate pointer comparisons and stack validation.',
      'Strong developer skills, syntax was flawless. Needs slightly better communication structure.'
    );

    -- 3. Create 1 completed interview lacking feedback (Action Item!)
    int_id_3 := gen_random_uuid();
    INSERT INTO public.interviews (id, title, interviewer_id, candidate_id, status, problem_statement, scheduled_at)
    VALUES (
      int_id_3,
      'React Frontend Core Round - State & Trees',
      NEW.id,
      mock_candidate_1,
      'completed'::public.interview_status,
      '{"title": "Maximum Depth of Binary Tree", "difficulty": "Easy", "description": "Given the root of a binary tree, return its maximum depth."}'::JSONB,
      now() - INTERVAL '1 hour'
    );

    -- 4. Create 2 Scheduled Interviews
    INSERT INTO public.interviews (title, interviewer_id, candidate_id, status, problem_statement, scheduled_at)
    VALUES (
      'Advanced Algorithms - Merge Intervals',
      NEW.id,
      mock_candidate_1,
      'scheduled'::public.interview_status,
      '{"title": "Merge Intervals", "difficulty": "Medium", "description": "Given an array of intervals where intervals[i] = [start_i, end_i], merge all overlapping intervals."}'::JSONB,
      now() + INTERVAL '5 hours'
    );

    INSERT INTO public.interviews (title, interviewer_id, candidate_id, status, problem_statement, scheduled_at)
    VALUES (
      'System Architecture Review - High Load Systems',
      NEW.id,
      mock_candidate_2,
      'scheduled'::public.interview_status,
      '{"title": "LRU Cache", "difficulty": "Hard", "description": "Design a data structure that follows the constraints of a Least Recently Used (LRU) cache."}'::JSONB,
      now() + INTERVAL '6 days' + INTERVAL '2 hours'
    );

  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach the dynamic seeding trigger after profile creation is complete
DROP TRIGGER IF EXISTS on_user_profile_created ON public.users;
CREATE TRIGGER on_user_profile_created
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE PROCEDURE public.auto_seed_user_data();

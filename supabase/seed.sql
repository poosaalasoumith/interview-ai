-- ====================================================
-- Supabase Local Development Seed Script
-- Path: supabase/seed.sql
-- ====================================================

-- 1. Create Baseline System Mock Users in auth.users
-- This enables developers to log in directly with these pre-seeded roles locally.
-- All passwords are encrypted as 'Password123!'

-- Mock Senior Tech Interviewer: Sarah Jenkins
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'sarah.jenkins@interviewai.demo',
  -- Blowfish encrypted 'Password123!'
  '$2a$10$w09ZkHw3mH67F37d1rQn/uxT/L67m7eSdf6zK3812dskxSj67xNn.', 
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Sarah Jenkins","role":"interviewer","avatar_url":"https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"}',
  now(),
  now(),
  'authenticated',
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Mock Senior Recruiter: Marcus Vance
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'marcus.vance@interviewai.demo',
  '$2a$10$w09ZkHw3mH67F37d1rQn/uxT/L67m7eSdf6zK3812dskxSj67xNn.',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Marcus Vance","role":"interviewer","avatar_url":"https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"}',
  now(),
  now(),
  'authenticated',
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Mock Star Candidate: Sophia Chen
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  'sophia.chen@interviewai.demo',
  '$2a$10$w09ZkHw3mH67F37d1rQn/uxT/L67m7eSdf6zK3812dskxSj67xNn.',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Sophia Chen","role":"candidate","avatar_url":"https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"}',
  now(),
  now(),
  'authenticated',
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Mock Candidate: Liam O'Connor
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
VALUES (
  '00000000-0000-0000-0000-000000000005',
  'liam.oconnor@interviewai.demo',
  '$2a$10$w09ZkHw3mH67F37d1rQn/uxT/L67m7eSdf6zK3812dskxSj67xNn.',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Liam O''Connor","role":"candidate","avatar_url":"https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"}',
  now(),
  now(),
  'authenticated',
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Mock Admin: System Administrator
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin@interviewai.demo',
  '$2a$10$w09ZkHw3mH67F37d1rQn/uxT/L67m7eSdf6zK3812dskxSj67xNn.',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Admin Console","role":"admin","avatar_url":"https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"}',
  now(),
  now(),
  'authenticated',
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Note: The triggers on_auth_user_created automatically replicate these users 
-- to public.users and run the auto_seed_user_data trigger to populate interviews 
-- and portfolios, ensuring that local development environment is immediately 
-- rich with structured demo entries on boot!

-- Add interview_telemetry to realtime publication if it exists and not already added
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_rel pr 
      JOIN pg_class c ON pr.prrelid = c.oid 
      JOIN pg_namespace n ON c.relnamespace = n.oid 
      WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
      AND n.nspname = 'public' 
      AND c.relname = 'interview_telemetry'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.interview_telemetry;
    END IF;
  END IF;
END $$;

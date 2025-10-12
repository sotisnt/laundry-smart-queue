-- Create a helper table to ensure types are generated
CREATE TABLE IF NOT EXISTS public.machine_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id TEXT NOT NULL,
  action TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.machine_logs ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view logs
CREATE POLICY "Anyone can view machine logs"
  ON public.machine_logs
  FOR SELECT
  USING (true);
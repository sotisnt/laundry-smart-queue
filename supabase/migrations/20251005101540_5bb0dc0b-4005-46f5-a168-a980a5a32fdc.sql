-- Create machine_usage table to track who uses machines
CREATE TABLE public.machine_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id TEXT NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  room_number TEXT NOT NULL,
  program_name TEXT NOT NULL,
  program_duration INTEGER NOT NULL,
  start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.machine_usage ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert usage records (when starting a machine)
CREATE POLICY "Anyone can insert usage records"
  ON public.machine_usage
  FOR INSERT
  WITH CHECK (true);

-- Allow anyone to view usage records (for admin page)
CREATE POLICY "Anyone can view usage records"
  ON public.machine_usage
  FOR SELECT
  USING (true);

-- Allow anyone to update usage records (when stopping a machine)
CREATE POLICY "Anyone can update usage records"
  ON public.machine_usage
  FOR UPDATE
  USING (true);

-- Enable realtime for usage tracking
ALTER PUBLICATION supabase_realtime ADD TABLE public.machine_usage;
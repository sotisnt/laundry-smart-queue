-- Create machines table
CREATE TABLE public.machines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('washer', 'dryer')),
  status TEXT NOT NULL CHECK (status IN ('available', 'in-use', 'done')),
  current_program_name TEXT,
  current_program_duration INTEGER,
  end_time TIMESTAMPTZ,
  can_postpone BOOLEAN,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert initial machines
INSERT INTO public.machines (id, name, type, status) VALUES
  ('w1', 'Washer 1', 'washer', 'available'),
  ('w2', 'Washer 2', 'washer', 'available'),
  ('w3', 'Washer 3', 'washer', 'available'),
  ('d1', 'Dryer 1', 'dryer', 'available'),
  ('d2', 'Dryer 2', 'dryer', 'available');

-- Enable Row Level Security
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read machines (public display)
CREATE POLICY "Anyone can view machines"
  ON public.machines
  FOR SELECT
  USING (true);

-- Allow everyone to update machines (anyone can start/stop)
CREATE POLICY "Anyone can update machines"
  ON public.machines
  FOR UPDATE
  USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.machines;

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER machines_updated_at
  BEFORE UPDATE ON public.machines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
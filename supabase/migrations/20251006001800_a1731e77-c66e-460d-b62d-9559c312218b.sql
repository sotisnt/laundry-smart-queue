-- Step 1: Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Step 2: Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Step 3: Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Step 4: Create profiles table for additional user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles RLS policies
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- Step 5: Add user_id to machine_usage table
ALTER TABLE public.machine_usage
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Step 6: Drop old insecure RLS policies on machine_usage
DROP POLICY IF EXISTS "Anyone can view usage records" ON public.machine_usage;
DROP POLICY IF EXISTS "Anyone can insert usage records" ON public.machine_usage;
DROP POLICY IF EXISTS "Anyone can update usage records" ON public.machine_usage;

-- Step 7: Create secure RLS policies for machine_usage
CREATE POLICY "Users can view their own usage records"
ON public.machine_usage FOR SELECT
USING (
  auth.uid() = user_id 
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Authenticated users can insert their own usage records"
ON public.machine_usage FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Only admins can update usage records"
ON public.machine_usage FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete usage records"
ON public.machine_usage FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Step 8: Update machines RLS policies
DROP POLICY IF EXISTS "Anyone can update machines" ON public.machines;

CREATE POLICY "Authenticated users can update machines"
ON public.machines FOR UPDATE
USING (
  auth.role() = 'authenticated'
  OR public.has_role(auth.uid(), 'admin')
);

-- Step 9: Add RLS policies for user_roles (admins only)
CREATE POLICY "Only admins can view user roles"
ON public.user_roles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can manage user roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Step 10: Create trigger for profile creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'display_name');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 11: Create trigger for updated_at on profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
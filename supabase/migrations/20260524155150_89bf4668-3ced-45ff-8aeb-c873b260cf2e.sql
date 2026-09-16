
CREATE TYPE public.complaint_category AS ENUM (
  'zero_tolerance_drugs_alcohol',
  'driver_conduct',
  'vehicle_safety',
  'discrimination',
  'accessibility',
  'billing',
  'other'
);

CREATE TYPE public.complaint_status AS ENUM ('open','investigating','resolved','dismissed');

CREATE TABLE public.complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NULL,
  reporter_user_id uuid NULL,
  reporter_name text NOT NULL,
  reporter_email text NOT NULL,
  reporter_phone text NULL,
  category public.complaint_category NOT NULL,
  description text NOT NULL,
  incident_at timestamptz NULL,
  status public.complaint_status NOT NULL DEFAULT 'open',
  reviewer_notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT complaints_desc_len CHECK (char_length(description) BETWEEN 10 AND 4000),
  CONSTRAINT complaints_name_len CHECK (char_length(reporter_name) BETWEEN 1 AND 120),
  CONSTRAINT complaints_email_len CHECK (char_length(reporter_email) BETWEEN 3 AND 254)
);

ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit complaints"
ON public.complaints FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admins read all complaints"
ON public.complaints FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update complaints"
ON public.complaints FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Reporters read own complaints"
ON public.complaints FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = reporter_user_id);

CREATE TRIGGER complaints_touch_updated_at
BEFORE UPDATE ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX complaints_created_at_idx ON public.complaints (created_at DESC);
CREATE INDEX complaints_status_idx ON public.complaints (status);


-- Versioning fields on generated_orders
ALTER TABLE public.generated_orders
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_order_id uuid REFERENCES public.generated_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pdf_url_original text,
  ADD COLUMN IF NOT EXISTS pdf_url_current text,
  ADD COLUMN IF NOT EXISTS incident_id uuid,
  ADD COLUMN IF NOT EXISTS absence_id uuid,
  ADD COLUMN IF NOT EXISTS order_no text,
  ADD COLUMN IF NOT EXISTS order_date date DEFAULT CURRENT_DATE;

-- Order versions history
CREATE TABLE IF NOT EXISTS public.order_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.generated_orders(id) ON DELETE CASCADE,
  version integer NOT NULL,
  content_md text NOT NULL,
  pdf_url text,
  note text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.order_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo_all_order_versions" ON public.order_versions FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_order_versions_order ON public.order_versions(order_id, version);

-- Teacher absences
CREATE TABLE IF NOT EXISTS public.teacher_absences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid,
  teacher_name text,
  reason text,
  absence_date date DEFAULT CURRENT_DATE,
  starts_at timestamptz DEFAULT now(),
  source text DEFAULT 'manual',
  substitutions jsonb DEFAULT '[]'::jsonb,
  order_id uuid REFERENCES public.generated_orders(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.teacher_absences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo_all_teacher_absences" ON public.teacher_absences FOR ALL USING (true) WITH CHECK (true);

-- Substitution order link
ALTER TABLE public.schedule_slots
  ADD COLUMN IF NOT EXISTS substitution_order_id uuid REFERENCES public.generated_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS absence_id uuid REFERENCES public.teacher_absences(id) ON DELETE SET NULL;

-- Director profile (own whatsapp etc)
CREATE TABLE IF NOT EXISTS public.app_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  full_name text,
  whatsapp text,
  phone text,
  metadata jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.app_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo_all_app_profile" ON public.app_profile FOR ALL USING (true) WITH CHECK (true);
INSERT INTO public.app_profile (key, full_name) VALUES ('director', 'Айгуль Серикбаевна')
  ON CONFLICT (key) DO NOTHING;

-- Storage bucket for orders PDF
INSERT INTO storage.buckets (id, name, public)
  VALUES ('orders', 'orders', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read orders" ON storage.objects FOR SELECT USING (bucket_id = 'orders');
CREATE POLICY "Public write orders" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'orders');
CREATE POLICY "Public update orders" ON storage.objects FOR UPDATE USING (bucket_id = 'orders');


-- Create tickets table
CREATE TABLE public.tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_full_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  issue_title TEXT NOT NULL,
  issue_category TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'Medium',
  issue_description TEXT NOT NULL,
  related_link TEXT,
  attachments TEXT[] DEFAULT '{}',
  preferred_contact_method TEXT DEFAULT 'Email',
  status TEXT NOT NULL DEFAULT 'New',
  monday_item_id TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  sync_error_message TEXT,
  assigned_to TEXT,
  internal_notes TEXT,
  chatbot_transcript JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Public can insert tickets (no auth required for support portal)
CREATE POLICY "Anyone can submit tickets" ON public.tickets
  FOR INSERT WITH CHECK (true);

-- Only authenticated users can view tickets (admin)
CREATE POLICY "Authenticated users can view tickets" ON public.tickets
  FOR SELECT TO authenticated USING (true);

-- Only authenticated users can update tickets
CREATE POLICY "Authenticated users can update tickets" ON public.tickets
  FOR UPDATE TO authenticated USING (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for ticket attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('ticket-attachments', 'ticket-attachments', true);

-- Storage policies
CREATE POLICY "Anyone can upload ticket attachments" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'ticket-attachments');

CREATE POLICY "Anyone can view ticket attachments" ON storage.objects
  FOR SELECT USING (bucket_id = 'ticket-attachments');

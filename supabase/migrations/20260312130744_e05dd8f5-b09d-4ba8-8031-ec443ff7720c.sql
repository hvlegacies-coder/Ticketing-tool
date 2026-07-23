
DROP POLICY IF EXISTS "Anyone can submit tickets" ON public.tickets;
CREATE POLICY "Anyone can submit tickets"
  ON public.tickets
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

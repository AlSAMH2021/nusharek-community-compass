-- Allow the creator to SELECT the organization row immediately after INSERT (needed for return=representation)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='organizations'
      AND policyname='Creators can view their organizations'
  ) THEN
    CREATE POLICY "Creators can view their organizations"
    ON public.organizations
    FOR SELECT
    TO authenticated
    USING (auth.uid() = created_by);
  END IF;
END $$;

-- Optional: also allow creator to UPDATE before membership row exists (harmless after membership exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='organizations'
      AND policyname='Creators can update their organizations'
  ) THEN
    CREATE POLICY "Creators can update their organizations"
    ON public.organizations
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = created_by);
  END IF;
END $$;
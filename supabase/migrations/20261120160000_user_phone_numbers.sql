-- Store each authenticated user's phone number separately from user_profiles.
-- Writes are performed by the authenticated backend using its service-role client.
-- Authenticated clients receive read access only to their own record.

CREATE TABLE IF NOT EXISTS public.user_phone_numbers (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text NOT NULL,
  phone_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_phone_numbers_phone_e164
    CHECK (phone ~ '^[+][1-9][0-9]{6,14}$')
);

ALTER TABLE public.user_phone_numbers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_phone_numbers'
      AND policyname = 'Users view own phone number'
  ) THEN
    CREATE POLICY "Users view own phone number"
      ON public.user_phone_numbers
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END
$$;

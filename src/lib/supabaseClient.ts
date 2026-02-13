console.log(
  "ENV check",
  "URL?", !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  "ANON?", !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,

  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
console.log(
  "ENV check",
  "URL?", !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  "ANON?", !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

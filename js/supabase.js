import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const SB_URL = "https://zzytdfbgslaftvqgeiao.supabase.co",
  SB_KEY = "sb_publishable_SaxYPtZGy1fO7Wdm-oG_Kg_epciZXln";
export const supabase = createClient(SB_URL, SB_KEY);
export const OWNER_EMAIL = "milesjosephmiller@gmail.com";
// This client-side check controls the UI. Database RLS must enforce write access.
export async function isOwner() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user?.email?.toLowerCase() === OWNER_EMAIL;
}

// Replace these with your project's actual values.
// Find them in the Supabase dashboard: Settings > API Keys
//   - Project URL
//   - Publishable key (the current client-safe key; Supabase is
//     phasing out the older "anon" key by end of 2026 — use
//     Publishable if your project has one)
const SUPABASE_URL = 'https://wilrrvuvpcpxuuchljgg.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_CSQqfjlillnLl4fD5Nn2Yw_DjnsUJFN';

// This key is meant to be public/client-side by design — it identifies
// the project but doesn't grant access on its own. Row Level Security
// (set up in schema.sql) is what actually controls who can read/write data.
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

function unconfigured(): never {
  throw new Error(
    "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
  );
}

/**
 * When Supabase secrets are missing we expose a Proxy that lets the app
 * mount (so the login page can show a config-warning banner) but throws
 * loudly the moment any auth method is actually called. No fake URL,
 * no silent fallback.
 */
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "olyxee-auth",
      },
    })
  : (new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === "auth") {
            return new Proxy(
              {},
              {
                get(_t, method) {
                  if (method === "onAuthStateChange") {
                    return () => ({
                      data: { subscription: { unsubscribe: () => {} } },
                    });
                  }
                  if (method === "getSession") {
                    return async () => ({ data: { session: null }, error: null });
                  }
                  return () => unconfigured();
                },
              },
            );
          }
          return () => unconfigured();
        },
      },
    ) as unknown as SupabaseClient);

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.error(
    "[supabase] VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set. Auth will not work until they are.",
  );
}

import { type NextRequest, type NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCookie, setCookie } from "cookies-next";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// https://github.com/supabase/supabase-js/issues/992#issuecomment-2057533936
export function createSupabaseReqResClient(
  req: NextRequest,
  res: NextResponse
) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return getCookie(name, { req, res });
        },
        set(name: string, value: string, options: CookieOptions) {
          setCookie(name, value, { req, res, ...options });
        },
        remove(name: string, options: CookieOptions) {
          setCookie(name, "", { req, res, ...options });
        },
      },
    }
  );
}

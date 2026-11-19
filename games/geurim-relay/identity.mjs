const hubURL = "https://lrwqrbmsehyevepqlcwp.supabase.co";
const hubPublicKey = "sb_publishable_lORBdTR6LW_Bjf1shr4Z0w_KPIjrLOO";
let client;

export async function hubSessionToken() {
  // Use the existing SDK session through the Supabase library's public API.
  client ??= window.supabase.createClient(hubURL, hubPublicKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("공용 사이트에 다시 로그인해 주세요.");
  return data.session.access_token;
}

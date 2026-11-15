// 허브 설정 — 허브 담당자만 수정
// supabaseUrl / supabaseKey 가 비어 있으면 "로컬 테스트 모드"로 동작한다
// (점수가 이 브라우저에만 저장됨). Supabase 연결 방법은 supabase/README.md 참고.
window.MINIHUB_CONFIG = {
  siteTitle: "8 미니게임",

  // Supabase → Project Settings → API (Data API) 의 Project URL
  supabaseUrl: "",

  // Supabase → Project Settings → API Keys 의 publishable 키 또는 legacy "anon public" 키
  // (공개돼도 되는 키. ⚠ service_role / secret 키는 절대 넣지 말 것)
  supabaseKey: "",
};

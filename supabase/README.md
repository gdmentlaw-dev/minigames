# Supabase 연결하기 (허브 담당자용, 약 15분)

연결 전에는 사이트가 **로컬 테스트 모드**로 돌아갑니다(점수가 내 브라우저에만 저장).
아래 순서대로 하면 온라인 랭킹이 됩니다. 비용은 0원이고 카드 등록도 필요 없습니다.

## 1. 프로젝트 만들기
1. [supabase.com](https://supabase.com) → **Start your project** → GitHub 계정으로 로그인
2. **New project**
   - Name: `minigames`
   - Database Password: **Generate a password**를 누르고 따로 메모해 둡니다 (아무에게도 공유하지 마세요)
   - Region: **Northeast Asia (Seoul)**
   - **Create new project** → 1~2분 기다리기

## 2. 익명 로그인 켜기
- 왼쪽 **Authentication** → **Sign In / Providers**
- **Allow anonymous sign-ins**를 켜고 **Save**

## 3. ⚠ 로그인 횟수 제한 늘리기 (꼭 하세요)
학교·행사장 와이파이처럼 **여러 명이 같은 인터넷을 쓰면** 기본 제한(시간당 30명)에 걸려서
31번째 사람부터 접속이 안 됩니다.
- **Authentication** → **Rate Limits**
- **Rate limit for anonymous users**를 `500` 정도로 올리고 **Save**

## 4. DB 만들기
- 왼쪽 **SQL Editor** → **New query**
- 이 폴더의 `schema.sql` 내용을 **전부 복사해서 붙여넣고** → **Run**
- 아래에 `Success. No rows returned`가 나오면 성공

## 5. 주소와 키를 사이트에 넣기
- 왼쪽 아래 **Project Settings**(톱니바퀴)
  - **Data API**(또는 API) → **Project URL** 복사
  - **API Keys** → **publishable** 키 복사
    (화면에 `anon` `public` 키만 보이면 그걸 복사해도 됩니다)
  - ❌ `service_role` / `secret` 키는 **절대 복사하거나 공유하지 마세요**
- `shared/minihub-sdk.js`를 열어서 맨 위 `CONFIG` 부분에 붙여넣기:
  ```js
  supabaseUrl: "https://xxxxxxxx.supabase.co",
  supabaseKey: "sb_publishable_xxxxxxxx",
  ```
- 저장하고 메인페이지를 새로고침 → 위쪽의 "로컬 테스트 모드" 노란 줄이 사라지면 온라인 연결 성공
- 이 파일 하나만 바꾸면 모든 게임이 같이 온라인으로 바뀝니다

## 6. 확인
- 휴대폰과 컴퓨터 두 곳에서 각각 다른 닉네임으로 접속 → 메인페이지에 `?dev=1`을 붙여 예제 게임 플레이
- 두 기기의 랭킹 화면에 둘 다 보이면 성공
- 다른 기기(또는 시크릿 창)에서 **같은 닉네임 + 같은 PIN**으로 접속 → 랭킹에 한 줄로 이어지면 완료
- 오픈 전에 예제 기록 지우기: SQL Editor에서
  `delete from public.bests where game_id like 'sample-%';`

## schema.sql이 바뀌었을 때
- 기능이 추가되면 `schema.sql`이 바뀝니다. **SQL Editor → New query에 전체를 다시 붙여넣고 Run** 하세요.
- 여러 번 실행해도 기존 기록은 지워지지 않게 만들어져 있습니다.

## 얼굴 아이콘 기능을 켤 때 (schema.sql이 바뀐 경우)
- 위 "schema.sql이 바뀌었을 때"대로 SQL Editor에서 전체를 다시 Run 하면 됩니다.
- 이미 가입한 플레이어에게는 얼굴 번호가 **무작위로 한 번** 채워지고(다시 Run 해도 바뀌지 않음), 새로 가입하는 사람은 첫 접속 때 직접 고릅니다.
- Run 하기 전에는 사이트가 닉네임으로 정한 임시 얼굴을 보여주고, 얼굴 저장만 되지 않습니다.

## 주의
- **7일 동안 아무도 접속하지 않으면 프로젝트가 일시정지**됩니다.
  대시보드에서 **Restore**를 누르면 다시 켜집니다. 행사 전날 한 번 확인하세요.
- 참가자에게 공지: **"닉네임과 PIN 4자리를 기억하세요. 다른 기기에서도 똑같이 넣으면 기록이 이어져요. 다른 사이트 비밀번호는 쓰지 마세요."**
- PIN을 잊은 사람은 `schema.sql` 맨 아래 "PIN 초기화" SQL로 0000으로 바꿔주세요.
- 무료 플랜 용량(DB 500MB, 월 사용자 5만 명)은 210명이 한 달 써도 1%도 안 됩니다.

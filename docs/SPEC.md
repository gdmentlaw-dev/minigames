# 미니게임 랭킹 설계서 (SPEC v2)

8명이 각자 만든 미니게임의 점수를 한 곳에 모아, 플레이어별·게임별 최고 기록과
종합 랭킹을 관리한다. 최대 사용자 약 210명, 온라인 서비스.

> v2 변경: 게임을 감싸는 공통 화면(play.html, iframe)을 없앴다. 각 게임은 독립된 페이지이고,
> 공용 SDK가 게임 페이지에서 직접 점수를 DB에 기록한다.

---

## 1. 전체 구조

```
games/<게임ID>/index.html   (각자 자유롭게 만든 게임 페이지)
   └ shared/minihub-sdk.js  ── 닉네임·로그인·점수 기록 ──▶  Supabase (DB + 익명 로그인)
                                                                ▲
index.html (메인페이지)  ── 같은 SDK로 랭킹 조회 ─────────────┘
```

- 호스팅: GitHub Pages (main 브랜치, 저장소 루트). 서버 코드 없음.
- 모든 게임이 **같은 사이트 주소** 아래에 있으므로 닉네임·로그인 정보가 공유된다.
  (브라우저 저장공간은 사이트 주소별로 나뉜다. 다른 주소에 배포한 게임은 다른 사람으로 기록됨)
- 게임 담당자는 DB를 몰라도 된다. SDK 함수 2개(init, submitScore)만 쓴다.

## 2. 폴더 구조

```
/index.html              메인페이지 (내 기록, 게임 바로가기, 종합/게임별 랭킹)
/hub/                    메인페이지 js, css         (허브 담당자)
/shared/minihub-sdk.js   점수 기록 SDK + Supabase 설정 (허브 담당자. 게임 담당자 수정 금지)
/supabase/schema.sql     DB 표·보안 규칙·랭킹 계산
/games/index.json        메인페이지 게임 목록 (자동 생성. 직접 수정 금지)
/scripts/update-game-list.py, /.github/workflows/update-game-list.yml   목록 자동 생성기
/games/<게임ID>/         각 게임 (담당자 본인만 수정)
    index.html, game.json, thumbnail.png, ...
/docs/SPEC.md            이 문서
/CLAUDE.md, /AGENTS.md, /.github/copilot-instructions.md   AI용 규칙 (내용 동일)
```

## 3. game.json

```json
{
  "id": "snake",
  "title": "스네이크",
  "author": "홍길동",
  "description": "사과를 먹고 길어지세요",
  "scoreOrder": "desc",
  "scoreUnit": "점",
  "scoreLimit": 1000000,
  "thumbnail": "thumbnail.png"
}
```

| 필드 | 필수 | 설명 |
|---|---|---|
| id | ✅ | 폴더 이름과 같음. 영문 소문자·숫자·하이픈 |
| title, author, description | ✅ | 메인페이지 표시용 |
| scoreOrder | ✅ | `desc` = 높을수록 좋음, `asc` = 낮을수록 좋음(시간 기록 등) |
| scoreUnit | ✅ | 표시 단위 (점, 층, ms, 회 …) |
| scoreLimit | 권장 | **만점이 아니라 조작 방지 상한선.** 생략 시 1억 |
| thumbnail | 선택 | 기본 `thumbnail.png` |
| entry | 선택 | 시작 페이지가 index.html이 아닐 때 파일명 |
| hidden | 선택 | `true`면 메인페이지 목록에서 숨김 (예제용). `?dev=1`로 보임 |

## 4. 점수 규칙

1. **점수에는 상한이 없다.** 스테이지를 더 깨고 기록이 좋아질수록 계속 오른다.
2. 점수는 **0 이상 정수**. 시간 기록은 ms 정수.
3. 플레이어마다 게임별로 **최고 기록 1개만** 남는다. 못한 판은 저장되지 않는다.
4. 게임별 랭킹은 **실제 점수**로 정렬 (scoreOrder 기준). 동점은 같은 순위.
5. 종합 랭킹은 게임별 순위를 **0~100 포인트**로 바꿔 합산 (8게임이면 최대 800).

   ```
   포인트 = 100 × (그 게임에서 나보다 기록이 나쁜 사람 수 + 1) ÷ 그 게임 참여자 수
   ```
   - 1등 = 100, 꼴찌 ≈ 1, 안 한 게임 = 0. 소수 첫째 자리까지.
   - 남이 나를 앞지르면 내 포인트는 내려간다.
6. 종합 순위 동점: 참여 게임 수가 많은 사람 → 마지막 기록을 먼저 세운 사람 순.
7. 종합 랭킹에는 메인페이지 목록(`games/index.json`)에 있고 hidden이 아닌 게임만 들어간다.

## 5. SDK (shared/minihub-sdk.js)

게임에서 쓰는 것:

```js
MiniHub.init("snake");                 // 필수. 페이지 로드 시 1회. 접속 전이면 닉네임+PIN 입력창 표시
MiniHub.onReady(player => {});         // 선택. player = { id, name }
const r = await MiniHub.submitScore(n);// 필수. 한 판 끝날 때마다 1회
// r = { score, improved, previous, best, rank, players } / 실패 시 null
// 옵션: submitScore(n, { toast: false }) → 기본 알림 끄기
MiniHub.exit();                        // 선택. 메인페이지로 이동
MiniHub.changeName();                  // 선택. 내 정보 창 (닉네임 바꾸기 / 다른 닉네임으로 접속)
MiniHub.getGameRanking("snake", 10);   // 선택. 게임 안에서 순위표 보여줄 때
MiniHub.getMyBest();                   // 선택. 이 게임의 내 최고 기록 → 숫자 또는 null
await MiniHub.save({ stage: 3 });      // 선택. 진행 저장 (플레이어·게임별 1칸, 최대 20KB) → true/false
await MiniHub.load();                  // 선택. 진행 불러오기 → 저장값 또는 null
```

진행 저장(`save`/`load`):
- 하다 만 상태(마지막 스테이지 등)를 로그인한 플레이어별로 서버에 저장. 다른 기기에서도 이어짐.
- 게임마다 한 칸, 덮어쓰기. `save(null)`이면 삭제. JSON 값만, 최대 20KB.
- 본인만 읽고 쓸 수 있음. 랭킹과는 무관 (랭킹은 `submitScore`).
- 빠르게 여러 번 불러도 마지막 값만 저장됨. 스테이지 클리어·게임오버 등 중요한 순간에만 호출 권장.

SDK가 하는 일:
- 익명 로그인 + 닉네임·PIN 접속 창 (Shadow DOM이라 게임 CSS와 안 섞임)
- `games/<id>/game.json`을 읽어 scoreOrder / scoreLimit 확인
- 점수 검증(정수, 0 ≤ score ≤ scoreLimit) → DB `submit_score` 함수 호출
- 저장 결과 알림 (신기록, 순위)
- 여러 판을 빨리 보내도 순서대로 하나씩 저장

설정(허브 담당자): SDK 맨 위 `CONFIG`의 `supabaseUrl`, `supabaseKey`.
비어 있으면 **로컬 테스트 모드**(이 브라우저의 localStorage에만 저장).

## 6. 로그인

- **닉네임(2~10자) + PIN(숫자 4자리)**. 닉네임은 겹칠 수 없다 (영문 대소문자 구분 없음).
- 처음 게임이나 메인페이지를 열면 접속 창이 뜬다.
  - 없는 닉네임 → 새로 등록
  - 있는 닉네임 + 맞는 PIN → 그 사람으로 접속 (다른 기기에서도 기록이 이어짐)
  - PIN 5번 틀리면 그 닉네임은 10분 잠금
- 한 번 접속한 브라우저는 다음부터 자동 접속 (Supabase 익명 로그인 세션이 기기를 기억).
- 메인페이지 오른쪽 위 이름 → 닉네임 바꾸기 / 다른 닉네임으로 접속.
- PIN을 잊으면 허브 담당자가 SQL Editor에서 0000으로 초기화 (schema.sql 맨 아래).
- PIN 4자리는 장난 방지용이다. 은행 비밀번호처럼 강한 보안은 아니므로 다른 곳 비밀번호를 쓰지 말라고 공지.

## 7. 데이터 (Supabase)

| 표 / 뷰 | 내용 |
|---|---|
| `players` | id, name (닉네임 중복 불가) |
| `player_secrets` | PIN(암호화), 틀린 횟수, 잠금 시각 — 아무도 직접 못 읽음 |
| `player_devices` | 기기(익명 로그인 uid) → 플레이어 연결. 한 사람이 여러 기기 가능 |
| `games` | id, score_order, score_limit — 첫 점수가 들어올 때 game.json 값으로 자동 등록 |
| `bests` | game_id, player_id, score, achieved_at — 플레이어·게임별 최고 기록 |
| `saves` | player_id, game_id, data(json), updated_at — 게임 진행 저장. 본인만 `load_save`/`save_game` 함수로 접근 |
| `game_ranking` (뷰) | 게임별 순위·포인트 |
| `overall_ranking(p_games)` (함수) | 종합 순위 |

- 접속은 `login`, 닉네임 변경은 `rename_player`, 점수 저장은 `submit_score`, 진행 저장은 `save_game` 함수로만 가능 (표에 직접 쓰기 금지).
- 닉네임·기록 읽기는 누구나, PIN은 아무도 못 읽음, 삭제는 관리자만 (SQL Editor). PIN 초기화도 SQL Editor에서 (schema.sql 맨 아래).
- 게임의 scoreOrder/scoreLimit을 나중에 바꾸면 `games` 표도 SQL로 고쳐야 한다 (schema.sql 맨 아래 참고).

## 8. 배포 흐름

1. 팀원: `games/<내ID>/` 작업 → 커밋 → 동기화(푸시)
2. GitHub Actions가 `games/*/game.json` 이 있는 폴더를 찾아 `games/index.json`을 자동 갱신·커밋 (예제 sample-는 맨 뒤)
3. GitHub Pages가 1~2분 안에 자동 반영. 게임 주소: `https://<계정>.github.io/<저장소>/games/<ID>/`

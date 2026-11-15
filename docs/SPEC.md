# 미니게임 통합 사이트 설계서 (SPEC v1)

8명이 각자 만든 미니게임을 한 사이트(허브)에 모아, 하나의 닉네임으로 플레이하고
게임별 랭킹과 종합 랭킹을 보여준다. 최대 사용자 약 210명, 온라인 서비스.

> 이 문서는 팀 전체의 약속이다. 바꿔야 할 일이 생기면 허브 담당자가 고치고 공지한다.

---

## 1. 전체 구조

```
[사용자 브라우저]
  허브 페이지 (index / play / ranking)  ──점수 저장·조회──▶  Supabase (DB + 익명 로그인)
     └ iframe: games/<게임ID>/index.html
          └ shared/minihub-sdk.js  ──postMessage──▶ 허브
```

- 호스팅: GitHub Pages (main 브랜치, 저장소 루트). 서버 코드 없음.
- DB: Supabase 무료 플랜. 허브만 DB에 접근한다. 게임은 DB를 모른다.
- 게임은 iframe 안에서 돈다. 서로의 코드·CSS가 섞이지 않는다.

## 2. 폴더 구조

```
/index.html              허브 메인 (닉네임, 게임 목록, 종합 랭킹 미리보기)
/play.html?game=<id>     게임 플레이 화면 (iframe)
/ranking.html            종합 랭킹 / 게임별 랭킹
/hub/                    허브 전용 js, css  (허브 담당자만 수정)
/shared/minihub-sdk.js   게임↔허브 연결 SDK  (수정 금지, 허브 담당자만 버전업)
/supabase/schema.sql     DB 표·보안 규칙·랭킹 계산
/games/index.json        사이트에 노출할 게임 ID 목록
/games/<게임ID>/         각 게임 (담당자 본인만 수정)
    index.html
    game.json
    thumbnail.png (또는 game.json의 thumbnail에 적은 파일)
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
  "controls": "방향키 / 스와이프",
  "scoreOrder": "desc",
  "scoreUnit": "점",
  "scoreLimit": 1000000,
  "thumbnail": "thumbnail.png"
}
```

| 필드 | 필수 | 설명 |
|---|---|---|
| id | ✅ | 폴더 이름과 같음. 영문 소문자·숫자·하이픈 |
| title, author, description, controls | ✅ | 화면 표시용 |
| scoreOrder | ✅ | `desc` = 높을수록 좋음, `asc` = 낮을수록 좋음(시간 기록 등) |
| scoreUnit | ✅ | 표시 단위 (점, 층, ms, 회 …) |
| scoreLimit | 선택 | **만점이 아니라 조작 방지 상한선.** 넉넉하게(고수 기록의 10배 정도). 생략 시 1억 |
| thumbnail | 선택 | 기본 `thumbnail.png` |
| hidden | 선택 | `true`면 목록에서 숨김 (샘플·개발용). `?dev=1`로 보임 |

## 4. 점수 규칙

1. **점수에는 상한이 없다.** 스테이지를 더 깨고 기록이 좋아질수록 점수가 계속 오른다.
2. 점수는 **0 이상 정수**. 시간 기록은 ms 정수로 보낸다.
3. 플레이어마다 게임별로 **최고 기록 1개만** 남는다. 못한 판은 저장되지 않는다.
4. 게임별 랭킹은 **실제 점수**로 정렬한다 (scoreOrder 기준). 동점은 같은 순위.
5. 종합 랭킹은 게임별 순위를 **0~100 포인트**로 바꿔 합산한다 (8게임이면 최대 800).

   ```
   포인트 = 100 × (그 게임에서 나보다 기록이 나쁜 사람 수 + 1) ÷ 그 게임 참여자 수
   ```
   - 1등 = 100, 꼴찌 ≈ 1, 안 한 게임 = 0. 소수 첫째 자리까지.
   - 참여자 수가 달라도 공평하고, 많은 게임에 참여할수록 유리하다.
   - 남이 나를 앞지르면 내 포인트는 내려간다.
6. 종합 순위 동점: 참여 게임 수가 많은 사람 → 마지막 기록을 먼저 세운 사람 순.

## 5. 게임 ↔ 허브 통신 (postMessage)

게임은 `shared/minihub-sdk.js`의 함수만 쓴다.

```js
MiniHub.init("snake");               // 로드 시 1회
MiniHub.onReady(player => {});       // player = { id, name }
MiniHub.submitScore(1250);           // 게임오버마다 정확히 1회, 0 이상 정수
MiniHub.exit();                      // 허브로 나가기
```

메시지 형식 (SDK가 처리하므로 게임 담당자는 몰라도 됨):

| 방향 | 메시지 |
|---|---|
| 게임 → 허브 | `{ type: "MINIHUB_READY", gameId, version: 1 }` |
| 허브 → 게임 | `{ type: "MINIHUB_INIT", player: { id, name } }` |
| 게임 → 허브 | `{ type: "MINIHUB_SCORE", gameId, score }` |
| 게임 → 허브 | `{ type: "MINIHUB_EXIT", gameId }` |

허브 검증: `event.source === iframe.contentWindow`, gameId 일치, 정수, 0 ≤ score ≤ scoreLimit.
DB에서도 같은 검증을 한 번 더 한다 (`submit_score` 함수).

## 6. 로그인

- Supabase **익명 로그인**. 같은 브라우저면 자동으로 같은 사람.
- 첫 방문 시 닉네임(2~10자) 입력, 언제든 변경 가능. 랭킹에는 바뀐 이름이 바로 반영.
- 다른 기기·브라우저로 접속하면 새 사람으로 취급된다. (공지할 것)

## 7. 데이터 (Supabase)

| 표 / 뷰 | 내용 |
|---|---|
| `players` | id(로그인 uid), name |
| `games` | id, score_order, score_limit — 첫 점수가 들어올 때 game.json 값으로 자동 등록 |
| `bests` | game_id, player_id, score, achieved_at — 플레이어·게임별 최고 기록 |
| `game_ranking` (뷰) | 게임별 순위·포인트 |
| `overall_ranking` (뷰) | 종합 순위 |

- 점수 저장은 `submit_score` 함수로만 가능 (표에 직접 쓰기 금지).
- 읽기는 누구나, 이름 변경은 본인만, 삭제는 아무도 못 함.
- 게임의 scoreOrder/scoreLimit을 나중에 바꾸면 `games` 표도 SQL로 고쳐야 한다.

## 8. 화면 공통 규칙

- 게임 기준 화면: 세로 9:16 (360×640 기준), 창에 맞춰 비율 유지 스케일.
- 터치 필수, 키보드 선택. 시작화면 → 플레이 → 게임오버(점수·다시하기·나가기).
- 공통 색: 배경 `#16132e`, 카드 `#231f45`, 강조 `#ffc83d`, 보조 `#7c6cf0`, 글자 `#f4f2ff`
- 공통 폰트: Pretendard (없으면 시스템 기본)

## 9. 배포 흐름

1. 팀원: `games/<내ID>/` 작업 → 커밋 → 동기화(푸시) 또는 PR
2. 허브 담당자: 확인 후 main에 합치고 `games/index.json`에 ID 추가
3. GitHub Pages가 1~2분 안에 자동 반영

# AI 작업 규칙 — 미니게임 통합 사이트

이 저장소는 8명이 각자 만든 미니게임을 하나의 사이트(허브)에 모으는 프로젝트다.
전체 설계는 `docs/SPEC.md`에 있다. 사용자는 코딩 초보자이니 쉬운 말로 설명한다.

## 작업 시작 전에 꼭 확인

- 사용자가 **어떤 게임(게임 ID)을 맡았는지** 모르면 먼저 물어본다.
  게임 담당자는 `games/<게임ID>/` 폴더 **안에서만** 작업한다.
- 허브 담당자(랭킹 사이트 담당)만 `index.html`, `play.html`, `ranking.html`, `hub/`,
  `shared/`, `supabase/`, `games/index.json`, 이 규칙 파일들을 수정한다.
- `shared/minihub-sdk.js`는 **누구도 수정하지 않는다.** 이상해 보이면 수정하지 말고 사용자에게 알린다.
- 다른 사람의 게임 폴더, 루트의 다른 파일은 만들거나 고치거나 지우지 않는다.

## 게임 만들기 규칙

### 파일
```
games/<게임ID>/
  index.html      이 파일 하나를 열면 바로 실행되어야 함
  game.json       게임 정보 (아래 형식)
  thumbnail.png   목록용 정사각형 이미지 (svg도 가능, game.json의 thumbnail에 파일명)
  그 외 js/css/이미지/소리 자유
```
- 게임 ID: 영문 소문자·숫자·하이픈만. 폴더 이름과 같게.
- 모든 경로는 **상대경로** (`./img/a.png`). `/img/a.png` 같은 절대경로 금지.
- 빌드 도구를 쓰면 base를 `./`로 설정하고 빌드 결과물을 이 폴더에 넣는다.
- 외부 CDN 라이브러리는 버전을 고정한다.

### 허브 연결 (필수)
`index.html`에 다음을 넣는다:
```html
<script src="../../shared/minihub-sdk.js"></script>
```
그리고 이 함수들만 쓴다:
```js
MiniHub.init("<게임ID>");               // 페이지 로드 시 1회
MiniHub.onReady(player => { ... });     // player.name 을 시작화면에 표시 ("OOO님")
MiniHub.submitScore(점수);               // 게임오버마다 정확히 1회. 0 이상 정수
MiniHub.exit();                         // 게임 안의 "나가기" 버튼
```
- 점수에는 **만점이 없다.** 스테이지를 더 깨고 기록이 좋을수록 계속 오르게 만든다.
- 시간 기록 게임은 ms 단위 정수로 보낸다 (낮을수록 좋음 → scoreOrder "asc").
- 다시하기 → 새 판 → 그 판이 끝나면 다시 submitScore 1회.
- 최고 기록 저장·비교는 허브가 한다. 게임은 이번 판 점수만 보내면 된다.

### 금지
- 자체 로그인, 이름 입력창, 랭킹 저장/표시, 서버·DB 연결 (허브가 담당)
- `alert` / `confirm` / `prompt` → 게임 화면 안의 UI로 대신
- `location.href` 등 페이지 이동 → `MiniHub.exit()` 사용
- 터치/클릭 전 소리 자동재생. 음소거 버튼을 제공한다.
- localStorage 키는 반드시 `<게임ID>_` 로 시작 (예: `snake_settings`)

### 화면·조작
- 세로 9:16 (360×640 기준)으로 만들고 창 크기에 맞춰 **비율을 유지하며 스케일**.
  어떤 크기의 iframe에 들어가도 잘리거나 스크롤이 생기면 안 된다.
- **터치 조작 필수** (모바일 앱으로도 나감). 키보드는 추가 지원.
- 흐름: 시작화면(제목, 조작법, 시작 버튼) → 플레이 → 게임오버(점수, 다시하기, 나가기)
- 탭이 숨겨지면(`visibilitychange`) 자동 일시정지.
- 공통 색: 배경 `#16132e`, 카드 `#231f45`, 강조 `#ffc83d`, 보조 `#7c6cf0`, 글자 `#f4f2ff`
- 공통 폰트: Pretendard
  (`https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css`)

### game.json
```json
{
  "id": "<게임ID>",
  "title": "한글 제목",
  "author": "만든 사람 이름",
  "description": "한 줄 설명",
  "controls": "예: 화면 탭 / 스페이스바",
  "scoreOrder": "desc",
  "scoreUnit": "점",
  "scoreLimit": 1000000,
  "thumbnail": "thumbnail.png"
}
```
- `scoreOrder`: 높을수록 좋으면 `"desc"`, 낮을수록 좋으면 `"asc"`
- `scoreLimit`: 만점이 아니라 **조작 방지 상한선**. 고수 기록의 10배쯤으로 넉넉하게.

### 참고 예제
- `games/sample-tap/` (높을수록 좋은 게임), `games/sample-reaction/` (낮을수록 좋은 게임)
  둘 다 위 규칙을 모두 지키는 최소 예제다. 구조를 참고한다.

### 테스트
- 저장소 폴더를 VS Code Live Server(또는 `python -m http.server`)로 열고
  `/games/<게임ID>/` 로 접속한다. `file://`로 열면 안 된다.
- 허브 없이 열면 Guest로 플레이되고, 게임오버 때 콘솔에
  `[MiniHub] (단독 실행) <게임ID> score = N` 이 찍히면 정상.
- 허브에서 확인: `/play.html?game=<게임ID>` (목록에 없어도 주소로 열 수 있음)

### 끝나면 체크리스트로 보고
- [ ] `games/<게임ID>/` 밖을 건드리지 않음
- [ ] 상대경로만 사용
- [ ] MiniHub.init / onReady / submitScore / exit 사용
- [ ] 게임오버당 submitScore 정확히 1회, 0 이상 정수
- [ ] alert·자체 로그인·자체 랭킹 없음
- [ ] 모바일 터치로 끝까지 플레이 가능
- [ ] 9:16 비율 유지, 스크롤 없음
- [ ] game.json, 썸네일 존재

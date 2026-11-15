# AI 작업 규칙 — 미니게임 랭킹 프로젝트

이 저장소는 8명이 각자 만든 미니게임의 점수를 **하나의 랭킹**으로 모으는 프로젝트다.
게임은 각자 자유롭게 만들고, 점수 기록만 공용 파일(`shared/minihub-sdk.js`)로 통일한다.
전체 설계는 `docs/SPEC.md`에 있다. 사용자는 코딩 초보자이니 쉬운 말로 설명한다.

## 작업 시작 전에 꼭 확인

- 사용자가 **어떤 게임(게임 ID)을 맡았는지** 모르면 먼저 물어본다.
  게임 담당자는 `games/<게임ID>/` 폴더 **안에서만** 작업한다.
- 허브 담당자(랭킹 담당)만 `index.html`, `hub/`, `shared/`, `supabase/`, `games/index.json`,
  이 규칙 파일들을 수정한다.
- `shared/minihub-sdk.js`는 게임 담당자가 **수정하지 않는다.** 이상해 보이면 고치지 말고 사용자에게 알린다.
- 다른 사람의 게임 폴더, 루트의 다른 파일은 만들거나 고치거나 지우지 않는다.

## 게임 만들기 — 꼭 지킬 것 (점수 기록용)

게임 내용·화면·기술은 자유다. 아래만 지키면 랭킹에 연결된다.

### 1. 폴더와 파일
```
games/<게임ID>/
  index.html      게임 시작 페이지
  game.json       게임 정보 (아래 형식)
  thumbnail.png   메인페이지 목록용 정사각형 이미지 (svg도 가능)
  그 외 파일 자유
```
- 게임 ID: 영문 소문자·숫자·하이픈만. 폴더 이름과 같게.
- 게임은 **이 저장소 안에** 있어야 한다. (같은 사이트 주소여야 닉네임과 기록이 이어진다.
  다른 곳에 따로 배포한 게임은 다른 사람으로 기록된다.)
- 경로는 상대경로로 쓴다 (`./img/a.png`). 빌드 도구를 쓰면 base를 `./`로 하고 결과물을 이 폴더에 넣는다.

### 2. 점수 기록 SDK 연결
`index.html`에 다음 한 줄을 넣는다 (폴더 깊이가 다르면 `../` 개수를 맞춘다):
```html
<script src="../../shared/minihub-sdk.js"></script>
```
그리고:
```js
MiniHub.init("<게임ID>");           // 페이지가 열릴 때 1회. 접속 전이면 SDK가 닉네임+PIN 입력창을 띄운다
MiniHub.onReady(player => {         // (선택) player.name 으로 "OOO님" 표시
  ...
});
MiniHub.submitScore(점수);           // 한 판이 끝날 때마다 정확히 1회. 0 이상 정수
```
- 점수에는 **만점이 없다.** 스테이지를 더 깨고 기록이 좋을수록 계속 오르게 만든다.
- 시간 기록 게임은 **ms 단위 정수**로 보낸다 (낮을수록 좋음 → game.json의 scoreOrder `"asc"`).
- 최고 기록 비교·저장은 SDK가 한다. 게임은 **이번 판 점수만** 보내면 된다.
- 저장되면 SDK가 화면 위쪽에 "🎉 신기록!" 같은 알림을 자동으로 띄운다.
- 결과를 게임 화면에도 보여주고 싶으면:
  ```js
  const r = await MiniHub.submitScore(점수);
  // r = { score, improved, previous, best, rank, players }  (저장 실패 시 null)
  // 알림을 끄려면 MiniHub.submitScore(점수, { toast: false })
  ```
- (선택) `MiniHub.exit()` → 메인페이지로 이동. "메인으로" 버튼에 쓰면 좋다.
- (선택) 게임 안에서 순위표를 보여주고 싶으면 `await MiniHub.getGameRanking("<게임ID>", 10)`
  → `[{ rank, name, score, ... }]`

### 3. 하지 말 것
- 자체 로그인·닉네임·PIN 입력창 만들기 (SDK가 한다)
- 서버·DB에 직접 연결하기, 점수를 다른 곳에 저장하기
- `minihub_` 또는 `sb-` 로 시작하는 localStorage 키 건드리기 (닉네임·로그인 정보)
- 게임 자체 저장값의 localStorage 키는 `<게임ID>_` 로 시작 (예: `snake_settings`). 모든 게임이 같은 저장공간을 쓴다.

### 4. game.json
```json
{
  "id": "<게임ID>",
  "title": "한글 제목",
  "author": "만든 사람 이름",
  "description": "한 줄 설명",
  "scoreOrder": "desc",
  "scoreUnit": "점",
  "scoreLimit": 1000000,
  "thumbnail": "thumbnail.png"
}
```
- `scoreOrder`: 높을수록 좋으면 `"desc"`, 낮을수록 좋으면 `"asc"`
- `scoreUnit`: 랭킹에 표시할 단위 (점, 층, ms, 회 …)
- `scoreLimit`: 만점이 아니라 **조작 방지 상한선**. 이보다 큰 점수는 무시된다. 고수 기록의 10배쯤으로 넉넉하게.

## 권장 사항 (안 지켜도 랭킹은 동작)

- 휴대폰에서도 플레이 가능하게 (터치 조작, 화면 크기에 맞춤)
- 흐름: 시작화면 → 플레이 → 게임오버(점수, 다시하기, 메인으로)
- 터치/클릭 전 소리 자동재생 금지, 음소거 버튼
- 공통 색: 배경 `#16132e`, 카드 `#231f45`, 강조 `#ffc83d`, 보조 `#7c6cf0`, 글자 `#f4f2ff`
- 공통 폰트: Pretendard
  (`https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css`)

## 참고 예제
- `games/sample-tap/` (높을수록 좋은 게임), `games/sample-reaction/` (낮을수록 좋은 게임)

## 테스트
- 저장소 폴더를 VS Code Live Server(또는 `python -m http.server`)로 열고
  `/games/<게임ID>/` 로 접속한다. `file://`로 열면 안 된다.
- 한 판 끝내고 위쪽에 기록 알림이 뜨면 정상. 랭킹은 `/` (루트 index.html)에서 확인.
  아직 `games/index.json`에 없는 게임이면 `/?dev=1` 로도 안 보일 수 있으니 허브 담당자에게 ID를 알려준다.

## 끝나면 체크리스트로 보고
- [ ] `games/<게임ID>/` 밖을 건드리지 않음
- [ ] `MiniHub.init("<게임ID>")` 호출, ID가 폴더 이름과 같음
- [ ] 한 판 끝날 때마다 `submitScore` 정확히 1회, 0 이상 정수
- [ ] game.json (scoreOrder, scoreUnit, scoreLimit 포함), 썸네일 존재
- [ ] 자체 로그인·자체 점수 서버 없음
- [ ] 로컬 서버로 열어서 기록 알림이 뜨는 것 확인

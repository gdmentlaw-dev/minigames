# 미니게임

8명이 각자 만든 미니게임의 점수를 하나의 랭킹으로 모으는 프로젝트.
게임은 자유롭게 만들고, 점수 기록만 공용 SDK로 통일한다.

- 전체 설계: [docs/SPEC.md](docs/SPEC.md)
- 게임 만들 때 규칙 (AI도 자동으로 읽음): [CLAUDE.md](CLAUDE.md)
- 온라인 DB 연결 (허브 담당자): [supabase/README.md](supabase/README.md)

## 게임 담당자

1. `games/<내 게임ID>/` 폴더를 만들고 그 안에서만 작업
2. `index.html`에 SDK 한 줄 넣고 `MiniHub.init("<게임ID>")`, 한 판 끝날 때 `MiniHub.submitScore(점수)`
3. `game.json` 작성 (예제: `games/sample-tap/`, `games/sample-reaction/`)
4. VS Code Live Server로 `/games/<내 게임ID>/` 열어서 테스트 → 커밋 → 동기화

## 실행해 보기

VS Code Live Server로 열거나, 저장소 폴더에서:

```bash
python -m http.server 5500
```

메인페이지: `http://localhost:5500/?dev=1` (`?dev=1`은 숨겨진 예제 게임까지 보기)

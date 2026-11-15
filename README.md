# 8 미니게임

8명이 각자 만든 미니게임을 한 사이트에 모아 게임별 랭킹과 종합 랭킹을 보여주는 프로젝트.

- 전체 설계: [docs/SPEC.md](docs/SPEC.md)
- 게임 만들 때 규칙 (AI도 자동으로 읽음): [CLAUDE.md](CLAUDE.md)
- 온라인 DB 연결 (허브 담당자): [supabase/README.md](supabase/README.md)

## 게임 담당자

1. `games/<내 게임ID>/` 폴더를 만들고 그 안에서만 작업
2. 예제 참고: `games/sample-tap/`, `games/sample-reaction/`
3. VS Code에서 저장소 폴더를 Live Server로 열고 `/games/<내 게임ID>/` 와 `/play.html?game=<내 게임ID>` 로 테스트
4. 커밋 → 동기화

## 실행해 보기

VS Code Live Server로 열거나, 저장소 폴더에서:

```bash
python -m http.server 5500
```

브라우저에서 `http://localhost:5500/?dev=1` (`?dev=1`은 숨겨진 예제 게임까지 보기)

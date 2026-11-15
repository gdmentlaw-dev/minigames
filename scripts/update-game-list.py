# games/ 폴더를 훑어서 games/index.json(메인페이지에 보일 게임 목록)을 다시 만든다.
# GitHub Actions(.github/workflows/update-game-list.yml)가 main에 올라올 때마다 자동 실행한다.
# 규칙: games/<게임ID>/game.json 이 있는 폴더만, 게임ID는 영문 소문자·숫자·하이픈
#       예제 게임(sample-)은 맨 뒤. 숨기려면 game.json에 "hidden": true
import json
import os
import re

GAMES = "games"
ids = []
for name in os.listdir(GAMES):
    folder = os.path.join(GAMES, name)
    if not os.path.isdir(folder) or not re.fullmatch(r"[a-z0-9-]{1,40}", name):
        continue
    if not os.path.isfile(os.path.join(folder, "game.json")):
        print(f"건너뜀: {name} (game.json 없음)")
        continue
    ids.append(name)

ids.sort(key=lambda x: (x.startswith("sample-"), x))

with open(os.path.join(GAMES, "index.json"), "w", encoding="utf-8", newline="\n") as f:
    json.dump(ids, f, ensure_ascii=False, indent=2)
    f.write("\n")
print("게임 목록:", ids)

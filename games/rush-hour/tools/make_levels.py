# 러시아워 퍼즐 생성기
# 사용법: python tools/make_levels.py [총 판수=30] [탐색 시간(초)=120]
#  - 이미 있는 levels.json의 판은 그대로 두고(저장된 기록이 꼬이지 않게 id 유지), 모자란 만큼 새로 만든다.
#  - 전체를 최소 이동 수 순으로 정렬해 'no'(화면에 보이는 번호)를 다시 매긴다.
import random, json, sys, time, os
from collections import deque

N = 6
TOTAL = int(sys.argv[1]) if len(sys.argv) > 1 else 30
TIME_LIMIT = float(sys.argv[2]) if len(sys.argv) > 2 else 120

def solve(cars):
    fixed = [(c[2], c[3], c[1] if c[3] else c[0]) for c in cars]
    start = tuple((c[0] if c[3] else c[1]) for c in cars)
    seen = {start: 0}
    q = deque([start])
    while q:
        s = q.popleft(); d = seen[s]
        if s[0] + fixed[0][0] == N: return d      # 빨간 차가 출구 앞에 닿으면 끝 (나가는 동작은 이동으로 세지 않음)
        g = [[-1]*N for _ in range(N)]
        for i,(ln,h,f) in enumerate(fixed):
            p = s[i]
            for k in range(ln):
                if h: g[f][p+k] = i
                else: g[p+k][f] = i
        for i,(ln,h,f) in enumerate(fixed):
            p = s[i]
            for dirn in (-1, 1):
                np_ = p
                while True:
                    np_ += dirn
                    a = np_ if dirn < 0 else np_ + ln - 1
                    if a < 0 or a >= N: break
                    if (g[f][a] if h else g[a][f]) != -1: break
                    t = list(s); t[i] = np_; t = tuple(t)
                    if t not in seen:
                        seen[t] = d + 1; q.append(t)
    return None

def valid(cars):
    g = [[False]*N for _ in range(N)]
    for x,y,ln,h in cars:
        for k in range(ln):
            r, c = (y, x+k) if h else (y+k, x)
            if r < 0 or r >= N or c < 0 or c >= N or g[r][c]: return False
            g[r][c] = True
        if h and y == 2 and (x,y,ln,h) != cars[0]: return False   # 출구 줄에는 가로 차 금지
    return True

def random_board():
    cars = [(random.randint(0, 3), 2, 2, True)]
    for _ in range(random.randint(8, 13)):
        for _try in range(30):
            ln = random.choice((2, 2, 2, 3)); h = random.random() < 0.5
            x = random.randint(0, N-1 - (ln-1 if h else 0)); y = random.randint(0, N-1 - (0 if h else ln-1))
            c = (x, y, ln, h)
            if valid(cars + [c]): cars.append(c); break
    return cars

def mutate(cars):
    cars = list(cars)
    r = random.random()
    if r < 0.6 and len(cars) > 1:                    # 차 하나를 다른 자리로
        i = random.randrange(1, len(cars)); ln = cars[i][2]; h = cars[i][3]
        x = random.randint(0, N-1 - (ln-1 if h else 0)); y = random.randint(0, N-1 - (0 if h else ln-1))
        cars[i] = (x, y, ln, h)
    elif r < 0.8 and len(cars) < 14:                 # 차 추가
        ln = random.choice((2, 2, 3)); h = random.random() < 0.5
        x = random.randint(0, N-1 - (ln-1 if h else 0)); y = random.randint(0, N-1 - (0 if h else ln-1))
        cars.append((x, y, ln, h))
    elif len(cars) > 7:                              # 차 제거
        cars.pop(random.randrange(1, len(cars)))
    return cars if valid(cars) else None

# 기존 판 불러오기
existing = []
if os.path.exists("levels.json"):
    existing = json.load(open("levels.json", encoding="utf-8"))["levels"]
keep = [{"id": l["id"], "min": l["min"], "cars": l["cars"]} for l in existing]
need = TOTAL - len(keep)

# 새 판이 채워야 할 난이도 목표 (전체가 3~26 수로 고르게 퍼지도록)
lo, hi = 2, 25
targets = [round(lo + (hi - lo) * i / (TOTAL - 1)) for i in range(TOTAL)]
have = sorted(l["min"] for l in keep)
want = []
pool = list(targets)
for m in have:                                       # 이미 있는 판과 가장 가까운 목표를 하나씩 소거
    j = min(range(len(pool)), key=lambda k: abs(pool[k] - m)); pool.pop(j)
want = pool[:need] if len(pool) >= need else pool
print("새로 필요한 난이도:", want)

cand = {}                                            # min -> [cars...]
def offer(cars, m):
    lst = cand.setdefault(m, [])
    if cars not in lst and len(lst) < 6: lst.append(cars)

T0 = time.time(); random.seed(7)
pop = []
while time.time() - T0 < TIME_LIMIT:
    cars = random_board(); m = solve(cars)
    if m is None: continue
    offer(cars, m); pop.append((m, cars))
    # 어려운 판은 조금씩 바꿔 보며 더 어렵게 키운다
    for _ in range(25):
        c2 = mutate(cars)
        if not c2: continue
        m2 = solve(c2)
        if m2 is None: continue
        offer(c2, m2)
        if m2 >= m: cars, m = c2, m2

print("찾은 최소 이동 수:", sorted(cand))
new = []
used = set()
for t in want:
    ks = [k for k in cand if any(tuple(map(tuple, c)) not in used for c in cand[k])]
    if not ks: break
    k = min(ks, key=lambda k: abs(k - t))
    for c in cand[k]:
        key = tuple(map(tuple, c))
        if key not in used:
            used.add(key); new.append((k, c)); break

nid = max([l["id"] for l in keep] + [0]) + 1
for m, c in new:
    keep.append({"id": nid, "min": m, "cars": [[x, y, ln, 'h' if h else 'v'] for x,y,ln,h in c]}); nid += 1
keep.sort(key=lambda l: (l["min"], l["id"]))
for i, l in enumerate(keep): l["no"] = i + 1
with open("levels.json", "w", encoding="utf-8") as f:
    json.dump({"levels": keep}, f, ensure_ascii=False, separators=(",", ":"))
print("총", len(keep), "판 / 최소 이동 수:", [l["min"] for l in keep])

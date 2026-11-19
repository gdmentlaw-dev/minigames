const codePattern = /^[A-HJ-NP-Z2-9]{7}$/u;
const tokenPattern = /^[\da-f-]{36}\.[\da-f-]{36}$/u;

export function cleanProgress(value, playerId) {
  const fresh = { version: 1, playerId, updatedAt: 0, rooms: [] };
  if (value?.version !== 1 || value.playerId !== playerId || !Array.isArray(value.rooms)) return fresh;
  const seen = new Set();
  const rooms = value.rooms.filter((room) => {
    if (!codePattern.test(room?.code) || !tokenPattern.test(room?.token) || seen.has(room.code)) return false;
    seen.add(room.code);
    return true;
  }).slice(0, 5).map((room) => ({
    code: room.code,
    token: room.token,
    baselineWins: Number.isSafeInteger(room.baselineWins) && room.baselineWins >= 0 ? room.baselineWins : null,
    finished: room.finished && Number.isSafeInteger(room.finished.score) && room.finished.score >= 0
      ? { score: room.finished.score,
          best: Number.isSafeInteger(room.finished.best) && room.finished.best >= 0 ? room.finished.best : room.finished.score,
          rank: Number.isSafeInteger(room.finished.rank) && room.finished.rank > 0 ? room.finished.rank : null } : null,
  }));
  return { ...fresh, updatedAt: Number.isSafeInteger(value.updatedAt) ? value.updatedAt : 0, rooms };
}

export function rememberRoom(progress, code, token) {
  const previous = progress.rooms.find((room) => room.code === code);
  const room = { code, token, baselineWins: previous?.baselineWins ?? null, finished: previous?.finished ?? null };
  progress.rooms = [room, ...progress.rooms.filter((entry) => entry.code !== code)].slice(0, 5);
  return room;
}

export function sessionScore(room, totalWins) {
  if (room?.finished) return room.finished.score;
  if (!Number.isSafeInteger(totalWins) || totalWins < 0 || room?.baselineWins === null || !room) return 0;
  return Math.max(0, totalWins - room.baselineWins) * 100;
}

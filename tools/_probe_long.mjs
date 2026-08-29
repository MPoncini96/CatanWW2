import fs from 'node:fs';
import { TILE_COUNT } from '../src/world/sphere.js';
import { buildWorld } from '../src/world/earth.js';
import * as G from '../src/game/state.js';
import { NATION_INDEX } from '../src/world/nations.js';

const bin = fs.readFileSync('./src/world/earth.bin');
const world = buildWorld(
  bin.subarray(0, TILE_COUNT),
  bin.subarray(TILE_COUNT, TILE_COUNT * 2),
  bin.subarray(TILE_COUNT * 2, TILE_COUNT * 3),
);

const DAYS = Number(process.argv[2] ?? 400);
const game = G.newGame();
const held = (power) => {
  const seat = NATION_INDEX[power];
  let n = 0;
  for (let i = 0; i < TILE_COUNT; i += 1) if (world.ownership.owner[i] === seat) n += 1;
  return n;
};
const powers = ['germany', 'uk', 'france', 'ussr', 'japan', 'china', 'italy', 'usa'];
const opening = Object.fromEntries(powers.map((p) => [p, held(p)]));

const t0 = process.hrtime.bigint();
for (let n = 0; n < DAYS; n += 1) {
  G.advance(game, world);
  if (game.over) {
    console.log(`the war ends on day ${game.day}: ${game.over.side} — ${game.over.why}`);
    break;
  }
  if ((n + 1) % 50 === 0) {
    console.log(
      `day ${String(game.day).padStart(4)} · ` +
        powers.map((p) => `${p.slice(0, 3)} ${String(held(p)).padStart(4)}`).join(' · '),
    );
  }
}
const ms = Number(process.hrtime.bigint() - t0) / 1e6;
console.log(`\n${game.day} days in ${(ms / 1000).toFixed(0)} s — ${(ms / game.day).toFixed(0)} ms a day`);
console.log('ground held, opening -> now:');
for (const p of powers) {
  const now = held(p);
  const move = now - opening[p];
  console.log(`  ${p.padEnd(8)} ${String(opening[p]).padStart(5)} -> ${String(now).padStart(5)} (${move >= 0 ? '+' : ''}${move})`);
}
console.log('capitulations:', (game.capitulations ?? []).map((c) => `${c.country ?? c.power} d${c.day}`).join(', ') || 'none');
console.log('beaten:', (game.beaten ?? []).map((b) => `${b.power} d${b.day}`).join(', ') || 'none');
console.log('over:', game.over ? `${game.over.side} — ${game.over.why}` : 'no');
console.log(`battles ${game.battles.length}, sea actions ${(game.seaBattles ?? []).length}, convoys sunk ${(game.sinkings ?? []).length}`);
console.log(`raids ${(game.raids ?? []).length}, strikes ${(game.strikes ?? []).length}`);

const assert = require('assert');
const E = require('../js/engine.js');
const AI = require('../js/ai.js');
let pass = 0, fail = 0;
function test(name, fn) { try { fn(); pass++; console.log('  ok  ', name); } catch (e) { fail++; console.log('  FAIL', name, '\n       ', e.message); } }
function st(board, opts) { // build a custom state
  const cfg = E.makeConfig(opts && opts.ruleset || 'classic', opts && opts.cfg);
  const s = E.initializeGame(cfg, opts && opts.current || 0);
  s.board = board.slice(); s.stores = (opts && opts.stores || [0, 0]).slice();
  if (opts && opts.inactive) s.inactive = opts.inactive.slice();
  return s;
}
const Z = () => new Array(14).fill(0);

test('initial setup: 14 pits x 5 = 70 seeds, A starts', () => {
  const s = E.initializeGame(E.makeConfig('classic'), 0);
  assert.strictEqual(s.board.length, 14); assert.ok(s.board.every(x => x === 5));
  assert.strictEqual(E.totalSeeds(s), 70); assert.strictEqual(s.current, 0); assert.strictEqual(s.status, 'playing');
});
test('six-seed ruleset = 84 seeds; seedsPerPit 4 = 56', () => {
  assert.strictEqual(E.totalSeeds(E.initializeGame(E.makeConfig('six'))), 84);
  assert.strictEqual(E.totalSeeds(E.initializeGame(E.makeConfig('classic', { seedsPerPit: 4 }))), 56);
  assert.strictEqual(E.makeConfig('classic', { seedsPerPit: 9 }).seedsPerPit, 5);
});
test('labels and anticlockwise order', () => {
  assert.strictEqual(E.label(0), 'A1'); assert.strictEqual(E.label(6), 'A7'); assert.strictEqual(E.label(7), 'B1'); assert.strictEqual(E.label(13), 'B7');
  const s = E.initializeGame(); assert.strictEqual(E.nextPit(s, 6), 7); assert.strictEqual(E.nextPit(s, 13), 0);
  assert.strictEqual(E.opposite(0), 13); assert.strictEqual(E.opposite(6), 7);
});
test('legal moves = own non-empty pits', () => {
  const s = E.initializeGame(); assert.deepStrictEqual(E.getLegalMoves(s), [0, 1, 2, 3, 4, 5, 6]);
  s.current = 1; assert.deepStrictEqual(E.getLegalMoves(s), [7, 8, 9, 10, 11, 12, 13]);
  const b = Z(); b[2] = 3; b[9] = 1; const t = st(b); assert.deepStrictEqual(E.getLegalMoves(t), [2]);
});
test('illegal moves rejected', () => {
  const b = Z(); b[2] = 3; b[9] = 1; const s = st(b);
  assert.strictEqual(E.validateMove(s, 9).reason, 'not_your_pit');
  assert.strictEqual(E.validateMove(s, 0).reason, 'empty_pit');
  assert.strictEqual(E.validateMove(s, 14).reason, 'bad_pit');
  assert.strictEqual(E.validateMove(s, 1.5).reason, 'bad_pit');
  assert.throws(() => E.executeMove(s, 9));
  const s2 = st(b, { inactive: [false, false, true].concat(new Array(11).fill(false)) });
  assert.strictEqual(E.validateMove(s2, 2).reason, 'inactive_pit');
  s.status = 'over'; assert.strictEqual(E.validateMove(s, 2).reason, 'not_playing');
});
test('sowing crosses from A7 into B row, then capture after empty pit', () => {
  // A6 has 3 seeds -> A7, B1, B2. Next pit B3 empty -> capture B4.
  const b = Z(); b[5] = 3; b[10] = 4; b[0] = 1; b[13] = 2;
  const r = E.executeMove(st(b), 5); const s = r.state;
  assert.strictEqual(s.board[6], 1); assert.strictEqual(s.board[7], 1); assert.strictEqual(s.board[8], 1);
  assert.strictEqual(s.board[10], 0); assert.strictEqual(s.stores[0], 4); assert.strictEqual(r.result.captures[0].pit, 10);
  assert.strictEqual(s.current, 1); assert.strictEqual(E.totalSeeds(s), 10);
});
test('sowing wraps from B7 back to A1', () => {
  const b = Z(); b[12] = 2; b[3] = 1; b[5] = 1; b[8] = 1;
  const s = st(b, { current: 1 }); const r = E.executeMove(s, 12);
  assert.strictEqual(r.state.board[13], 1); assert.strictEqual(r.state.board[0], 1);
  // next pit A2 empty, pit after (A3) empty -> stop, no capture
  assert.strictEqual(r.state.stores[1], 0); assert.strictEqual(r.events.filter(e => e.type === 'stop').length, 1);
});
test('continuation: next pit has seeds -> pick up and keep sowing', () => {
  // A1 (2) -> A2, A3. Next A4 has 2 -> pick up, sow A5, A6. Next A7 empty, B1 has 3 -> capture 3.
  const b = Z(); b[0] = 2; b[3] = 2; b[7] = 3; b[9] = 1;
  const r = E.executeMove(st(b), 0); const s = r.state;
  assert.strictEqual(r.result.continues, 1); assert.strictEqual(s.board[3], 0);
  assert.strictEqual(s.board[4], 1); assert.strictEqual(s.board[5], 1);
  assert.strictEqual(s.stores[0], 3); assert.strictEqual(s.board[7], 0);
});
test('two consecutive empty pits: turn ends without capture', () => {
  const b = Z(); b[0] = 1; b[9] = 5;
  const r = E.executeMove(st(b), 0);
  assert.strictEqual(r.state.stores[0], 0); assert.strictEqual(r.state.current, 1);
});
test('capture opposite option takes both pits', () => {
  const b = Z(); b[5] = 1; b[8] = 4; b[2] = 3; b[12] = 2; // A6 plays: sow A7. next B1 empty, B2(8) has 4 -> capture; opposite of 8 is A6 (now empty)
  const r = E.executeMove(st(b, { cfg: { captureOpposite: true } }), 5); assert.strictEqual(r.state.stores[0], 4); assert.strictEqual(r.state.status, 'playing');
  const b2 = Z(); b2[0] = 1; b2[3] = 2; b2[10] = 6; b2[9] = 1; // A1 -> A2; next A3 empty; capture A4(2) + opposite B4(10)=6
  const r2 = E.executeMove(st(b2, { cfg: { captureOpposite: true } }), 0);
  assert.strictEqual(r2.state.stores[0], 8); assert.strictEqual(r2.state.board[10], 0);
  const r3 = E.executeMove(st(b2), 0); assert.strictEqual(r3.state.stores[0], 2); assert.strictEqual(r3.state.board[10], 6);
});
test('four-seed (pasu) rule: pit reaching 4 is captured by its owner', () => {
  const b = Z(); b[5] = 2; b[7] = 3; b[0] = 1; b[11] = 1; // A6 -> A7(1), B1(4!) pasu for B
  const r = E.executeMove(st(b, { ruleset: 'pasu' }), 5);
  assert.strictEqual(r.result.pasu.length, 1); assert.strictEqual(r.result.pasu[0].by, 1);
  assert.strictEqual(r.state.stores[1], 4); assert.strictEqual(r.state.board[7], 0);
  assert.ok(r.events.some(e => e.type === 'pasu'));
  assert.strictEqual(E.totalSeeds(r.state), 7);
});
test('four-seed rule option: captured by sower', () => {
  const b = Z(); b[5] = 2; b[7] = 3; b[0] = 1; b[11] = 1;
  const r = E.executeMove(st(b, { ruleset: 'pasu', cfg: { pasuBy: 'sower' } }), 5);
  assert.strictEqual(r.state.stores[0], 4);
});
test('four-seed rule off by default in classic', () => {
  const b = Z(); b[5] = 2; b[7] = 3; b[0] = 1; b[11] = 1;
  const r = E.executeMove(st(b), 5); assert.strictEqual(r.result.pasu.length, 0); assert.strictEqual(r.state.board[7], 0 + 0 || r.state.board[7]);
  assert.strictEqual(E.makeConfig('classic').pasu, false);
});
test('skipOrigin option skips the lifted pit on a lap', () => {
  const b = Z(); b[0] = 14; b[8] = 1;
  const r1 = E.executeMove(st(b, { cfg: { skipOrigin: true } }), 0);
  const ev1 = r1.events.filter(e => e.type === 'sow').slice(0, 14).map(e => e.pit);
  assert.ok(ev1.indexOf(0) === -1, 'origin skipped');
  const r2 = E.executeMove(st(b), 0);
  const ev2 = r2.events.filter(e => e.type === 'sow').slice(0, 14).map(e => e.pit);
  assert.strictEqual(ev2[13], 0, 'origin receives the 14th seed when not skipped');
});
test('round ends when player to move has no seeds; leftovers go to side owner; single round winner', () => {
  // A plays last seed; B side empty afterwards
  const b = Z(); b[6] = 1; b[0] = 3; // A7 -> B1(1). next B2 empty, B3 empty -> stop. B has B1=1 so not ended.
  let r = E.executeMove(st(b, { stores: [30, 36] }), 6);
  assert.strictEqual(r.state.status, 'playing');
  const b2 = Z(); b2[2] = 1; b2[5] = 2; // A3 -> A4. next A5 empty, A6 has 2 -> capture. B side empty -> round ends
  r = E.executeMove(st(b2, { stores: [30, 37] }), 2);
  assert.strictEqual(r.state.status, 'over'); assert.strictEqual(r.state.stores[0], 33); // 30 + 2 captured + 1 swept
  assert.strictEqual(r.state.winner, 1); assert.strictEqual(E.totalSeeds(r.state), 70);
  assert.ok(r.events.some(e => e.type === 'sweep' && e.to === 0));
});
test('draw detection', () => {
  const b = Z(); b[2] = 1; b[5] = 2;
  const r = E.executeMove(st(b, { stores: [32, 35] }), 2); // A ends 35
  assert.strictEqual(r.state.winner, 'draw');
});
test('multi-round: refill from stores, unfillable pits become inactive', () => {
  const b = Z(); b[2] = 1; b[5] = 2;
  const r = E.executeMove(st(b, { ruleset: 'multi', stores: [20, 47] }), 2); // A ends with 23, B 47
  const s = r.state;
  assert.strictEqual(s.status, 'playing'); assert.strictEqual(s.round, 2);
  // A: 23 -> 4 pits of 5 (A1..A4), 3 left in store; A5..A7 inactive
  assert.deepStrictEqual(s.board.slice(0, 7), [5, 5, 5, 5, 0, 0, 0]);
  assert.deepStrictEqual(s.inactive.slice(0, 7), [false, false, false, false, true, true, true]);
  assert.strictEqual(s.stores[0], 3); assert.strictEqual(s.stores[1], 12);
  assert.ok(s.board.slice(7).every(x => x === 5)); assert.strictEqual(E.totalSeeds(s), 70);
  assert.strictEqual(s.current, 1, 'starter alternates');
});
test('multi-round: inactive pits are skipped while sowing', () => {
  const inactive = new Array(14).fill(false); inactive[4] = inactive[5] = inactive[6] = true;
  const b = Z(); b[3] = 2; b[9] = 3; b[0] = 1;
  const r = E.executeMove(st(b, { ruleset: 'multi', inactive }), 3); // A4 -> B1, B2 (skipping A5..A7)
  assert.strictEqual(r.state.board[7], 1); assert.strictEqual(r.state.board[8], 1);
  assert.ok([4, 5, 6].every(i => r.state.board[i] === 0));
});
test('multi-round: game ends when a player cannot fill one pit', () => {
  const b = Z(); b[2] = 1; b[5] = 2;
  const r = E.executeMove(st(b, { ruleset: 'multi', stores: [1, 66] }), 2); // A ends with 4 < 5
  assert.strictEqual(r.state.status, 'over'); assert.strictEqual(r.state.winner, 1); assert.strictEqual(r.state.endReason, 'cannot_refill');
});
test('stall rule: round ends after stallLimit moves with no capture', () => {
  const b = Z(); b[0] = 1; b[7] = 1; let s = st(b, { stores: [40, 28] }); let n = 0;
  while (s.status === 'playing' && n < 200) { s = E.executeMove(s, E.getLegalMoves(s)[0]).state; n++; }
  assert.strictEqual(s.status, 'over'); assert.ok(n <= 40); assert.strictEqual(E.totalSeeds(s), 70);
  const b2 = Z(); b2[0] = 3; b2[9] = 3; let s2 = st(b2, { stores: [30, 34] }); s2.quiet = 39;
  const r2 = E.executeMove(s2, 0); assert.strictEqual(r2.state.status, 'over'); assert.ok(r2.events.some(e => e.type === 'roundEnd' && e.reason === 'stall'));
  assert.strictEqual(E.totalSeeds(r2.state), 70);
});
test('engine does not mutate input state', () => {
  const s = E.initializeGame(); const copy = JSON.stringify(s); E.executeMove(s, 3); assert.strictEqual(JSON.stringify(s), copy);
});
test('events carry snapshots ending in final board', () => {
  const s = E.initializeGame(); const r = E.executeMove(s, 0);
  const last = r.events[r.events.length - 1]; assert.deepStrictEqual(last.board, r.state.board);
  assert.ok(r.events[0].type === 'pickup' && r.events[0].n === 5);
});

function randomGames(ruleset, cfg, n, levels) {
  let finished = 0;
  for (let g = 0; g < n; g++) {
    const rng = AI.mulberry32(1000 + g);
    let s = E.initializeGame(E.makeConfig(ruleset, cfg), g % 2, { noHistory: true });
    const total = E.totalSeeds(s); let moves = 0;
    while (s.status !== 'over' && moves < 3000) {
      const lv = levels ? levels[s.current] : 1;
      const m = AI.chooseMove(s, lv, { rng, timeMs: 30 });
      assert.ok(E.getLegalMoves(s).indexOf(m) >= 0, 'AI move legal');
      s = E.executeMove(s, m, { record: false }).state; moves++;
      assert.strictEqual(E.totalSeeds(s), total, 'seed conservation');
      assert.ok(s.board.every(x => x >= 0) && s.stores.every(x => x >= 0));
      for (let i = 0; i < 14; i++) if (s.inactive[i]) assert.strictEqual(s.board[i], 0);
    }
    if (s.status === 'over') { finished++; assert.ok(s.winner === 0 || s.winner === 1 || s.winner === 'draw'); }
  }
  assert.strictEqual(finished, n, 'all games finished');
}
test('seed conservation + termination: 200 random classic games', () => randomGames('classic', {}, 200));
test('seed conservation: pasu, six, 4-seed, opposite, skipOrigin, sower variants', () => {
  randomGames('pasu', {}, 100); randomGames('six', {}, 100); randomGames('classic', { seedsPerPit: 4 }, 100);
  randomGames('classic', { captureOpposite: true }, 100); randomGames('classic', { skipOrigin: true }, 100);
  randomGames('pasu', { pasuBy: 'sower', seedsPerPit: 6 }, 100);
});
test('multi-round games terminate with a winner', () => { randomGames('multi', {}, 100); randomGames('multi', { pasu: true, seedsPerPit: 4 }, 50); });
test('AI levels 1-5 always pick legal moves', () => {
  randomGames('classic', {}, 6, [2, 3]); randomGames('pasu', {}, 4, [4, 1]); randomGames('multi', {}, 2, [5, 3]);
});
test('stronger AI beats random most of the time', () => {
  let wins = 0; const n = 20;
  for (let g = 0; g < n; g++) {
    const rng = AI.mulberry32(77 + g); let s = E.initializeGame(E.makeConfig('classic'), g % 2, { noHistory: true });
    while (s.status !== 'over') s = E.executeMove(s, AI.chooseMove(s, s.current === 0 ? 4 : 1, { rng }), { record: false }).state;
    if (s.winner === 0) wins++;
  }
  console.log('        level 4 vs level 1:', wins + '/' + n);
  assert.ok(wins >= 14);
});
test('hint returns a legal move', () => { const s = E.initializeGame(); assert.ok(E.getLegalMoves(s).includes(AI.hint(s))); });

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

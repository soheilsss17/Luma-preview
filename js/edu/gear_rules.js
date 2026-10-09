// LUMA — pure gear-chain rules (opening tutorial «کوک», later MATH-03/04, W-11 machines). No rendering, no engine types.
// Mirrors unity/Assets/_Project/Scripts/Puzzles/GearChain/GearChainRules.cs; both pass GEAR_TUTORIAL.vectors.json.
//
// Physics at the level the child sees (plan 06: "rule-based, physics only at the level of the result"):
//  • two gears mesh when the distance of their axles equals the sum of their pitch radii (± tolerance);
//  • closer than that they collide → the whole driven chain jams (a comic shudder, nothing breaks);
//  • farther than that they do not touch → motion stops at the gap;
//  • meshed gears turn in opposite directions, speed ratio ω₂ = −ω₁ · r₁ / r₂ (no slip at the pitch circle).

export function gearRadius(puzzle, typeId) {
  const t = puzzle.gear_types.find((g) => g.id === typeId);
  if (!t) throw new Error(`unknown gear type ${typeId}`);
  return t.pitch_r;
}

/**
 * @param puzzle  data (gear_types, drive, output, pegs, mesh_tolerance)
 * @param placed  array (one per peg) of gear type ids or null
 * @returns {{nodes, meshes, collisions, jam, outputTurning}}
 *   nodes: [{key, x, y, r, type, state: 'turning'|'jam'|'still', omega}]  (key: 'drive' | 'output' | peg index)
 */
export function evaluateChain(puzzle, placed) {
  const tol = puzzle.mesh_tolerance;
  const nodes = [{ key: 'drive', x: puzzle.drive.x, y: puzzle.drive.y, type: puzzle.drive.type }];
  puzzle.pegs.forEach((p, i) => { if (placed[i]) nodes.push({ key: i, x: p.x, y: p.y, type: placed[i] }); });
  nodes.push({ key: 'output', x: puzzle.output.x, y: puzzle.output.y, type: puzzle.output.type });
  for (const n of nodes) { n.r = gearRadius(puzzle, n.type); n.state = 'still'; n.omega = 0; }
  const meshes = [], collisions = [];
  const adj = nodes.map(() => []);
  for (let a = 0; a < nodes.length; a++) {
    for (let b = a + 1; b < nodes.length; b++) {
      const d = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y), s = nodes[a].r + nodes[b].r;
      if (d < s - tol) collisions.push([nodes[a].key, nodes[b].key]);
      else if (d <= s + tol) { meshes.push([nodes[a].key, nodes[b].key]); adj[a].push(b); adj[b].push(a); }
    }
  }
  // breadth-first from the drive gear through meshed pairs
  const comp = new Set([0]);
  const queue = [0];
  nodes[0].omega = puzzle.drive.omega;
  while (queue.length) {
    const a = queue.shift();
    for (const b of adj[a]) {
      if (comp.has(b)) continue;
      nodes[b].omega = -nodes[a].omega * nodes[a].r / nodes[b].r;
      comp.add(b); queue.push(b);
    }
  }
  // any collision touching the driven group, or a group that also reaches a collided gear, jams the group
  const keyIdx = new Map(nodes.map((n, i) => [n.key, i]));
  const jam = collisions.some(([p, q]) => comp.has(keyIdx.get(p)) || comp.has(keyIdx.get(q)));
  for (const i of comp) {
    if (jam) { nodes[i].state = 'jam'; nodes[i].omega = 0; } else nodes[i].state = 'turning';
  }
  const out = nodes[nodes.length - 1];
  return { nodes, meshes, collisions, jam, outputTurning: out.state === 'turning' };
}

/** Classify one placement against the peg's requirement (for feedback, hints and analytics). */
export function classifyPlacement(puzzle, pegIndex, typeId) {
  const need = puzzle.pegs[pegIndex].need;
  if (typeId === need) return 'fits';
  return gearRadius(puzzle, typeId) > gearRadius(puzzle, need) ? 'too_big' : 'too_small';
}

/** Types that fit at least one still-empty (non-fixed) peg — answer assist keeps only these (no soft lock). */
export function usefulTypes(puzzle, stage, placed) {
  const need = new Set();
  stage.pegs.forEach((ps, i) => { if (ps === 'empty' && placed[i] !== puzzle.pegs[i].need) need.add(puzzle.pegs[i].need); });
  return need;
}

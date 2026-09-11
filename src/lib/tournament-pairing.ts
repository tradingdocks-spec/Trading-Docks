export type PairingPlayer = {
  id: string;
  seedOrder: number;
  matchPoints: number;
  opponents: string[];
  byeCount?: number;
};

export type Pairing = { playerOneId: string; playerTwoId: string | null; isBye: boolean };

export function pairSwissPlayers(players: PairingPlayer[], roundNumber: number): Pairing[] {
  const ordered = [...players].sort((a, b) => {
    if (roundNumber === 1) return a.seedOrder - b.seedOrder || a.id.localeCompare(b.id);
    return b.matchPoints - a.matchPoints || (a.byeCount ?? 0) - (b.byeCount ?? 0) || a.seedOrder - b.seedOrder || a.id.localeCompare(b.id);
  });
  if (ordered.length < 2) return ordered.map((player) => ({ playerOneId: player.id, playerTwoId: null, isBye: true }));

  const pairs: Pairing[] = [];
  let index = 0;
  if (ordered.length % 2 === 1) {
    const bye = [...ordered].reverse().find((player) => (player.byeCount ?? 0) === 0) ?? ordered.at(-1)!;
    ordered.splice(ordered.indexOf(bye), 1);
    pairs.push({ playerOneId: bye.id, playerTwoId: null, isBye: true });
  }
  while (index < ordered.length) {
    const first = ordered[index];
    let opponentIndex = index + 1;
    while (opponentIndex < ordered.length && first.opponents.includes(ordered[opponentIndex].id)) opponentIndex += 1;
    if (opponentIndex >= ordered.length) opponentIndex = index + 1;
    const opponent = ordered[opponentIndex];
    ordered.splice(opponentIndex, 1);
    pairs.push({ playerOneId: first.id, playerTwoId: opponent.id, isBye: false });
    index += 1;
  }
  return pairs;
}


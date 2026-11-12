/** Club 10 equity point levels — mirrors the engine; tunable copy lives in CMS. */
export const POINT_LEVELS = [
  { level: 1, name: "Starter", pts: 0, note: "Entry tier — onboarding, first lessons." },
  { level: 2, name: "Rising", pts: 2000, note: "Consistent activity unlocks more." },
  { level: 3, name: "Bronze", pts: 5000, note: "First closings · weekly coaching." },
  { level: 4, name: "Gold", pts: 12000, note: "Builder tier · team play begins." },
  { level: 5, name: "Platinum", pts: 25000, note: "Advanced closing & recruitment." },
  { level: 6, name: "Diamond", pts: 50000, note: "Leadership intensives · priority payouts." },
  { level: 7, name: "Elite", pts: 90000, note: "Mandate playbooks · briefings." },
  { level: 8, name: "Ambassador", pts: 150000, note: "Hosts sessions · shapes playbooks." },
  { level: 9, name: "Icon", pts: 250000, note: "First access to launches & estates." },
  { level: 10, name: "THE APEX", pts: 500000, note: "The highest level — earned, never bought." },
];

export function levelForPoints(pts: number) {
  let cur = POINT_LEVELS[0];
  for (const l of POINT_LEVELS) if (pts >= l.pts) cur = l;
  const next = POINT_LEVELS.find((l) => l.pts > pts) ?? null;
  const progress = next ? (pts - cur.pts) / (next.pts - cur.pts) : 1;
  return { ...cur, next, progress };
}

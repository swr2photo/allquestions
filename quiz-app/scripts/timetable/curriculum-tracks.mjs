/**
 * Splits the parsed years of an edition into tracks for plans whose years 3–4 print one table per track
 * (co-op / internship) that the parser reads as plain terms. `tracks` maps a track label to
 * { "<parsed year>/<parsed term>": "<output term>" }: the parsed terms of that track, numbered as the
 * plan numbers them. Parsed terms listed in no track are shared: a year with no track terms is kept as
 * it is, and a year with track terms becomes one entry per track holding the shared and the track's terms.
 * Only editions that set `tracks` in curriculum-sources.mjs use this.
 */
export function splitTracks(years, tracks) {
  const trackOf = new Map();
  for (const [label, map] of Object.entries(tracks)) {
    for (const parsed of Object.keys(map)) trackOf.set(parsed, label);
  }
  const out = [];
  for (const y of years) {
    const shared = y.terms.filter((t) => !trackOf.has(`${y.year}/${t.term}`));
    const withTrack = y.terms.some((t) => trackOf.has(`${y.year}/${t.term}`));
    if (!withTrack) {
      out.push({ ...y });
      continue;
    }
    for (const [label, map] of Object.entries(tracks)) {
      const own = y.terms
        .filter((t) => map[`${y.year}/${t.term}`] !== undefined)
        .map((t) => ({ ...t, term: Number(map[`${y.year}/${t.term}`].split("/")[1]) }));
      if (!own.length) continue;
      const terms = [...shared, ...own].sort((a, b) => a.term - b.term);
      out.push({ year: y.year, plan: label, terms });
    }
  }
  return out.sort((a, b) => a.year - b.year || (a.plan ?? "").localeCompare(b.plan ?? "", "th"));
}

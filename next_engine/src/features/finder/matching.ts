/** Rule-based similarity scores are comparison aids, not proof of ownership. */
export type FinderPost = {
  id: string;
  kind: "lost" | "found";
  status: "ACTIVE" | "CLOSED";
  category: string | null;
  color: string | null;
  generalLocation: string | null;
  occurredAt: string | null;
};

const normalize = (value: string | null) => value?.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase() || "";

function dayNumber(value: string | null): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) return null;
  return timestamp / 86_400_000;
}

export function scoreFinderMatch(a: FinderPost, b: FinderPost) {
  const categoryA = normalize(a.category), categoryB = normalize(b.category);
  const colorA = normalize(a.color), colorB = normalize(b.color);
  const locationA = normalize(a.generalLocation), locationB = normalize(b.generalLocation);
  const category = categoryA && categoryA === categoryB ? 40 : 0;
  const color = colorA && colorA === colorB ? 25 : 0;
  // Exact area: 20; one area contained in the other: 10; missing/other: 0.
  const location = !locationA || !locationB ? 0 : locationA === locationB ? 20 :
    locationA.includes(locationB) || locationB.includes(locationA) ? 10 : 0;
  const dayA = dayNumber(a.occurredAt), dayB = dayNumber(b.occurredAt);
  const difference = dayA === null || dayB === null ? Infinity : Math.abs(dayA - dayB);
  // Calendar days: same day 15, within 3 days 10, within 7 days 5, else 0.
  const date = difference === 0 ? 15 : difference <= 3 ? 10 : difference <= 7 ? 5 : 0;
  return { category, color, location, date, total: category + color + location + date };
}

export function rankFinderMatches<T extends FinderPost>(source: FinderPost, candidates: T[], limit = 20) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new RangeError("limit must be an integer from 1 to 100");
  if (source.status !== "ACTIVE") return [];
  const seen = new Set<string>();
  return candidates.flatMap((candidate) => {
    if (candidate.id === source.id || candidate.kind === source.kind || candidate.status !== "ACTIVE" || seen.has(candidate.id)) return [];
    seen.add(candidate.id);
    const score = scoreFinderMatch(source, candidate);
    return score.total >= 70 ? [{ post: candidate, score }] : [];
  }).sort((a, b) => b.score.total - a.score.total || a.post.id.localeCompare(b.post.id)).slice(0, limit);
}

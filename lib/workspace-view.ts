import type { Analysis, Post } from './domain';

export function filterCandidates(
  candidates: Analysis['candidates'],
  posts: Post[],
  search: string,
  fit = 'all',
) {
  const query = search.trim().toLowerCase();
  const byId = new Map(posts.map((post) => [post.id, post]));
  return candidates.filter((candidate) => {
    const post = byId.get(candidate.post_id);
    return (
      (fit === 'all' || candidate.fit === fit) &&
      [
        post?.author,
        post?.text,
        candidate.reason,
        candidate.need,
        candidate.timing,
        candidate.budget,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  });
}

type OutcomeSearch = {
  account: string;
  type: string;
  notes: string;
  source: string;
  attribution: string;
};
export function filterOutcomes<T extends OutcomeSearch>(
  outcomes: T[],
  search: string,
  type = 'all',
) {
  const query = search.trim().toLowerCase();
  return outcomes.filter(
    (outcome) =>
      (type === 'all' || outcome.type === type) &&
      [outcome.account, outcome.notes, outcome.source, outcome.attribution]
        .join(' ')
        .toLowerCase()
        .includes(query),
  );
}

export function paginate<T>(items: T[], requestedPage: number, pageSize = 10) {
  const size = Number.isFinite(pageSize) ? Math.max(1, Math.floor(pageSize)) : 10;
  const pages = Math.max(1, Math.ceil(items.length / size));
  const page = Number.isFinite(requestedPage)
    ? Math.min(pages, Math.max(1, Math.floor(requestedPage)))
    : 1;
  const start = (page - 1) * size;
  return {
    items: items.slice(start, start + size),
    page,
    pages,
    total: items.length,
    from: items.length ? start + 1 : 0,
    to: Math.min(start + size, items.length),
  };
}

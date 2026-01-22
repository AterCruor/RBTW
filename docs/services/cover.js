const normalizeCoverUrl = (value) => {
  if (!value) return '';
  return String(value).replace(/^http:\/\//i, 'https://');
};

const normalizeCoverSet = (coverSet = []) => {
  const byDescriptor = new Map();
  for (const item of coverSet) {
    if (!item || !item.url || !item.descriptor) continue;
    const normalizedUrl = normalizeCoverUrl(item.url);
    const existing = byDescriptor.get(item.descriptor);
    if (!existing || item.rank > existing.rank) {
      byDescriptor.set(item.descriptor, { ...item, url: normalizedUrl });
    }
  }
  return Array.from(byDescriptor.values()).sort((a, b) => a.rank - b.rank);
};

const googleCoverDescriptors = [
  { key: 'extraLarge', descriptor: '3x', rank: 9 },
  { key: 'large', descriptor: '2x', rank: 7 },
  { key: 'medium', descriptor: '1.5x', rank: 5 },
  { key: 'small', descriptor: '1x', rank: 3 },
  { key: 'thumbnail', descriptor: '1x', rank: 2 },
  { key: 'smallThumbnail', descriptor: '1x', rank: 1 },
];

export const selectBestGoogleCover = (imageLinks = {}) => {
  const coverSet = [];
  for (const entry of googleCoverDescriptors) {
    const url = normalizeCoverUrl(imageLinks[entry.key]);
    if (url) {
      coverSet.push({
        url,
        descriptor: entry.descriptor,
        rank: entry.rank,
      });
    }
  }
  const normalized = normalizeCoverSet(coverSet);
  const best = normalized.reduce(
    (acc, item) => (item.rank > acc.rank ? item : acc),
    { url: '', rank: 0 }
  );
  return {
    url: best.url,
    rank: best.rank,
    coverSet: normalized,
  };
};

export const selectBestOpenLibraryCover = (detailsCover, coverId) => {
  const coverSet = [];
  const seen = new Set();
  const add = (url, descriptor, rank) => {
    if (!url || seen.has(url)) return;
    const normalizedUrl = normalizeCoverUrl(url);
    seen.add(normalizedUrl);
    coverSet.push({ url: normalizedUrl, descriptor, rank });
  };

  if (detailsCover) {
    add(detailsCover.small, '1x', 2);
    add(detailsCover.medium, '1.5x', 4);
    add(detailsCover.large, '2x', 6);
  } else if (coverId) {
    add(`https://covers.openlibrary.org/b/id/${coverId}-S.jpg`, '1x', 2);
    add(`https://covers.openlibrary.org/b/id/${coverId}-M.jpg`, '1.5x', 4);
    add(`https://covers.openlibrary.org/b/id/${coverId}-L.jpg`, '2x', 6);
  }

  const normalized = normalizeCoverSet(coverSet);
  const best = normalized.reduce(
    (acc, item) => (item.rank > acc.rank ? item : acc),
    { url: '', rank: 0 }
  );

  return {
    url: best.url,
    rank: best.rank,
    coverSet: normalized,
  };
};

const rankOpenLibraryCover = (url) => {
  if (!url) return 0;
  if (url.includes('-L.') || url.includes('large')) return 6;
  if (url.includes('-M.') || url.includes('medium')) return 4;
  return 2;
};

export const pickBestCover = (base, extra) => {
  if (!base && !extra) return '';
  if (!base || !base.cover) return extra ? normalizeCoverUrl(extra.cover) || '' : '';
  if (!extra || !extra.cover) return normalizeCoverUrl(base.cover) || '';
  const baseRank = typeof base.coverRank === 'number' ? base.coverRank : rankOpenLibraryCover(base.cover);
  const extraRank = typeof extra.coverRank === 'number' ? extra.coverRank : rankOpenLibraryCover(extra.cover);
  return extraRank > baseRank ? normalizeCoverUrl(extra.cover) : normalizeCoverUrl(base.cover);
};

import { fetchOpenLibraryByIsbn, fetchOpenLibraryBySearch } from '../api/openLibrary.js';
import { fetchGoogleByIsbn, fetchGoogleBySearch } from '../api/googleBooks.js';
import { pickBestCover } from './cover.js';
import { getIsbnData } from './isbn.js';

const scoreDescriptionFormatting = (value) => {
  if (!value) return 0;
  const text = String(value);
  const matches = text.match(/<(p|br|b|strong|i|em)\b/gi);
  return matches ? matches.length : 0;
};

const pickRicherDescription = (baseDesc, extraDesc) => {
  if (!baseDesc) return extraDesc || null;
  if (!extraDesc) return baseDesc;
  const baseScore = scoreDescriptionFormatting(baseDesc);
  const extraScore = scoreDescriptionFormatting(extraDesc);
  if (extraScore !== baseScore) {
    return extraScore > baseScore ? extraDesc : baseDesc;
  }
  return String(extraDesc).length > String(baseDesc).length ? extraDesc : baseDesc;
};

const mergeMetadata = (base, extra) => {
  if (!base) return extra;
  if (!extra) return base;

  const baseCoverRank = base.coverRank || 0;
  const extraCoverRank = extra.coverRank || 0;
  const useExtraCover = extraCoverRank > baseCoverRank;

  return {
    ...base,
    title: base.title || extra.title,
    author: base.author || extra.author,
    description: pickRicherDescription(base.description, extra.description),
    pageCount: base.pageCount || extra.pageCount,
    cover: pickBestCover(base, extra),
    coverRank: Math.max(baseCoverRank, extraCoverRank),
    coverSet: useExtraCover ? extra.coverSet : base.coverSet,
    isbn10: base.isbn10 || extra.isbn10,
    isbn13: base.isbn13 || extra.isbn13,
    isbnNotes:
      base.isbnNotes && base.isbnNotes.length ? base.isbnNotes : extra.isbnNotes,
    quotes: base.quotes && base.quotes.length ? base.quotes : extra.quotes,
  };
};

const normalizeQuotes = (book) =>
  Array.isArray(book.quotes) ? book.quotes.map((quote) => String(quote)).filter(Boolean) : [];

const buildError = (source, book, error, label) => {
  const id = book.title || book.isbn13 || book.isbn10 || 'Unknown book';
  return {
    source,
    message: `${label} for "${id}".`,
    error,
  };
};

export const resolveBookMetadata = async (book, apiKey) => {
  const errors = [];
  let result = null;
  const manualCover = book.cover ? String(book.cover).replace(/^http:\/\//i, 'https://') : '';
  const quotes = normalizeQuotes(book);
  const needsOpenLibrarySearch = (value) =>
    !value ||
    !value.title ||
    !value.author ||
    !value.cover ||
    !value.description ||
    !value.pageCount;
  const needsGoogleLookup = (value) => {
    if (!value) return true;
    if (!value.cover || !value.description) return true;
    return scoreDescriptionFormatting(value.description) === 0;
  };

  if (needsGoogleLookup(result)) {
    try {
      const isbnData = getIsbnData(book);
      let googleResult = null;
      if (isbnData.isbn13 || isbnData.isbn10) {
        googleResult = await fetchGoogleByIsbn(book, apiKey);
      }
      if (!googleResult) {
        googleResult = await fetchGoogleBySearch(book, apiKey);
      }
      result = mergeMetadata(result, googleResult);
    } catch (error) {
      errors.push(buildError('googleBooks', book, error, 'Google Books lookup failed'));
    }
  }

  if (needsOpenLibrarySearch(result)) {
    try {
      const openLibraryIsbn = await fetchOpenLibraryByIsbn(book);
      result = mergeMetadata(result, openLibraryIsbn);
    } catch (error) {
      errors.push(buildError('openLibraryIsbn', book, error, 'Open Library ISBN lookup failed'));
    }
  }

  if (needsOpenLibrarySearch(result)) {
    try {
      const openLibrarySearch = await fetchOpenLibraryBySearch(book);
      result = mergeMetadata(result, openLibrarySearch);
    } catch (error) {
      errors.push(buildError('openLibrarySearch', book, error, 'Open Library search failed'));
    }
  }

  if (!result) {
    const isbnData = getIsbnData(book);
    result = {
      title: book.title || 'Unknown title',
      author: book.author || 'Unknown author',
      cover: '',
      pageCount: null,
      description: book.description || null,
      isbn10: isbnData.isbn10,
      isbn13: isbnData.isbn13,
      isbnNotes: isbnData.notes,
      quotes,
    };
  }

  if (manualCover) {
    result.cover = manualCover;
    result.coverSet = [{ url: manualCover, descriptor: '1x', rank: 10 }];
    result.coverRank = Math.max(result.coverRank || 0, 10);
  }

  result.quotes = quotes;

  return { metadata: result, errors };
};

import { fetchJson } from '../utils/http.js';
import { getIsbnData, selectIsbn13 } from '../services/isbn.js';
import { selectBestOpenLibraryCover } from '../services/cover.js';

const openLibrarySearchUrl = (title, author) => {
  const params = new URLSearchParams();
  if (title) params.set('title', title);
  if (author) params.set('author', author);
  params.set('limit', '1');
  return `https://openlibrary.org/search.json?${params.toString()}`;
};

const openLibraryBooksUrl = (isbn) =>
  `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(
    isbn
  )}&format=json&jscmd=data`;

const extractDescription = (details) => {
  if (!details || !details.description) return null;
  if (typeof details.description === 'string') return details.description;
  return details.description.value || null;
};

export const fetchOpenLibraryByIsbn = async (book) => {
  const isbnData = getIsbnData(book);
  const isbn = isbnData.isbn13 || isbnData.isbn10;
  if (!isbn) {
    return null;
  }

  const data = await fetchJson(openLibraryBooksUrl(isbn));
  const key = `ISBN:${isbn}`;
  const details = data[key];
  if (!details) {
    return null;
  }

  const coverSelection = selectBestOpenLibraryCover(details.cover, null);

  return {
    title: details.title || book.title,
    author: details.authors && details.authors[0] ? details.authors[0].name : book.author,
    cover: coverSelection.url,
    coverRank: coverSelection.rank,
    coverSet: coverSelection.coverSet,
    pageCount: details.number_of_pages || null,
    description: extractDescription(details),
    isbn10: isbnData.isbn10,
    isbn13: isbnData.isbn13,
    isbnNotes: isbnData.notes,
  };
};

export const fetchOpenLibraryBySearch = async (book) => {
  if (!book.title && !book.author) {
    return null;
  }

  const search = await fetchJson(openLibrarySearchUrl(book.title, book.author));
  const first = search.docs && search.docs[0];
  if (!first) {
    return null;
  }

  const isbn = selectIsbn13(first.isbn || []);
  const coverId = first.cover_i || null;
  if (!isbn) {
    return null;
  }

  const data = await fetchJson(openLibraryBooksUrl(isbn));
  const key = `ISBN:${isbn}`;
  const details = data[key];
  if (!details) {
    return null;
  }

  const isbnData = getIsbnData(book, isbn);
  const coverSelection = selectBestOpenLibraryCover(details.cover, coverId);

  return {
    title: details.title || book.title,
    author: details.authors && details.authors[0] ? details.authors[0].name : book.author,
    cover: coverSelection.url,
    coverRank: coverSelection.rank,
    coverSet: coverSelection.coverSet,
    pageCount: details.number_of_pages || null,
    description: extractDescription(details),
    isbn10: isbnData.isbn10,
    isbn13: isbnData.isbn13,
    isbnNotes: isbnData.notes,
  };
};

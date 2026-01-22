import { fetchJson } from '../utils/http.js';
import { getIsbnData } from '../services/isbn.js';
import { selectBestGoogleCover } from '../services/cover.js';

const googleBooksUrl = (query, apiKey) => {
  const params = new URLSearchParams();
  params.set('q', query);
  params.set('maxResults', '1');
  if (apiKey) params.set('key', apiKey);
  return `https://www.googleapis.com/books/v1/volumes?${params.toString()}`;
};

export const fetchGoogleByIsbn = async (book, apiKey) => {
  const isbnData = getIsbnData(book);
  const isbn = isbnData.isbn13 || isbnData.isbn10;
  if (!isbn) {
    return null;
  }

  const data = await fetchJson(googleBooksUrl(`isbn:${isbn}`, apiKey));
  const item = data.items && data.items[0];
  if (!item) {
    return null;
  }

  const info = item.volumeInfo || {};
  const googleCover = selectBestGoogleCover(info.imageLinks || {});
  return {
    title: info.title || book.title,
    author: info.authors ? info.authors[0] : book.author,
    cover: googleCover.url,
    coverRank: googleCover.rank,
    coverSet: googleCover.coverSet,
    pageCount: info.pageCount || null,
    description: info.description || null,
    isbn10: isbnData.isbn10,
    isbn13: isbnData.isbn13,
    isbnNotes: isbnData.notes,
  };
};

export const fetchGoogleBySearch = async (book, apiKey) => {
  if (!book.title && !book.author) {
    return null;
  }

  const parts = [];
  if (book.title) parts.push(`intitle:${book.title}`);
  if (book.author) parts.push(`inauthor:${book.author}`);
  const query = parts.join('+');

  const data = await fetchJson(googleBooksUrl(query, apiKey));
  const item = data.items && data.items[0];
  if (!item) {
    return null;
  }

  const info = item.volumeInfo || {};
  const googleCover = selectBestGoogleCover(info.imageLinks || {});
  const isbnData = getIsbnData(book);
  return {
    title: info.title || book.title,
    author: info.authors ? info.authors[0] : book.author,
    cover: googleCover.url,
    coverRank: googleCover.rank,
    coverSet: googleCover.coverSet,
    pageCount: info.pageCount || null,
    description: info.description || null,
    isbn10: isbnData.isbn10,
    isbn13: isbnData.isbn13,
    isbnNotes: isbnData.notes,
  };
};

const CONFIG_URL = './config.json';

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

const googleBooksUrl = (query, apiKey) => {
  const params = new URLSearchParams();
  params.set('q', query);
  params.set('maxResults', '1');
  if (apiKey) params.set('key', apiKey);
  return `https://www.googleapis.com/books/v1/volumes?${params.toString()}`;
};

const fetchJson = (url) =>
  fetch(url).then((res) => {
    if (!res.ok) {
      throw new Error(`Request failed (${res.status})`);
    }
    return res.json();
  });

const COVER_SIZES = '(max-width: 600px) 100vw, (max-width: 960px) 50vw, 240px';

const normalizeIsbn = (value) => {
  if (!value) return null;
  const cleaned = String(value).replace(/[^0-9X]/gi, '').toUpperCase();
  return cleaned || null;
};

const isValidIsbn10 = (value) => {
  if (!value || value.length !== 10) return false;
  const core = value.slice(0, 9);
  if (!/^\d{9}$/.test(core)) return false;
  const check = computeIsbn10CheckDigit(core);
  return value[9] === check;
};

const isValidIsbn13 = (value) => {
  if (!value || value.length !== 13) return false;
  if (!/^\d{13}$/.test(value)) return false;
  const core = value.slice(0, 12);
  const check = computeIsbn13CheckDigit(core);
  return value[12] === check;
};

const computeIsbn10CheckDigit = (isbn9) => {
  let sum = 0;
  for (let index = 0; index < 9; index += 1) {
    sum += (10 - index) * Number(isbn9[index]);
  }
  const remainder = sum % 11;
  const check = 11 - remainder;
  if (check === 10) return 'X';
  if (check === 11) return '0';
  return String(check);
};

const computeIsbn13CheckDigit = (isbn12) => {
  let sum = 0;
  for (let index = 0; index < 12; index += 1) {
    const digit = Number(isbn12[index]);
    sum += index % 2 === 0 ? digit : digit * 3;
  }
  const check = (10 - (sum % 10)) % 10;
  return String(check);
};

const deriveIsbn13From10 = (isbn10) => {
  if (!isbn10 || isbn10.length !== 10) return null;
  const core = `978${isbn10.slice(0, 9)}`;
  return core + computeIsbn13CheckDigit(core);
};

const deriveIsbn10From13 = (isbn13) => {
  if (!isbn13 || isbn13.length !== 13 || !isbn13.startsWith('978')) return null;
  const core = isbn13.slice(3, 12);
  return core + computeIsbn10CheckDigit(core);
};

const getIsbnData = (book, fallbackIsbn) => {
  const notes = [];
  const raw10 = normalizeIsbn(book && book.isbn10);
  const raw13 = normalizeIsbn(book && book.isbn13);
  let isbn10 = null;
  let isbn13 = null;

  if (raw10) {
    if (isValidIsbn10(raw10)) {
      isbn10 = raw10;
    } else {
      notes.push('Invalid ISBN-10');
    }
  }

  if (raw13) {
    if (isValidIsbn13(raw13)) {
      isbn13 = raw13;
    } else {
      notes.push('Invalid ISBN-13');
    }
  }

  const fallback = normalizeIsbn(fallbackIsbn);
  if (!isbn13 && fallback && fallback.length === 13 && isValidIsbn13(fallback)) {
    isbn13 = fallback;
  }
  if (!isbn10 && fallback && fallback.length === 10 && isValidIsbn10(fallback)) {
    isbn10 = fallback;
  }

  if (!isbn13 && isbn10) {
    isbn13 = deriveIsbn13From10(isbn10);
  }
  if (!isbn10 && isbn13) {
    const derived10 = deriveIsbn10From13(isbn13);
    if (derived10) isbn10 = derived10;
  }

  return { isbn10, isbn13, notes };
};

const normalizeCoverSet = (coverSet = []) => {
  const byDescriptor = new Map();
  for (const item of coverSet) {
    if (!item || !item.url || !item.descriptor) continue;
    const existing = byDescriptor.get(item.descriptor);
    if (!existing || item.rank > existing.rank) {
      byDescriptor.set(item.descriptor, item);
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

const selectBestGoogleCover = (imageLinks = {}) => {
  const coverSet = [];
  for (const entry of googleCoverDescriptors) {
    const url = imageLinks[entry.key];
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

const selectBestOpenLibraryCover = (detailsCover, coverId) => {
  const coverSet = [];
  const seen = new Set();
  const add = (url, descriptor, rank) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    coverSet.push({ url, descriptor, rank });
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

const pickBestCover = (openLibraryUrl, googleCover) => {
  const openLibraryRank = rankOpenLibraryCover(openLibraryUrl);
  if (googleCover && googleCover.rank > openLibraryRank) {
    return googleCover.url;
  }
  return openLibraryUrl || googleCover.url || '';
};

const selectIsbn13 = (isbns = []) => {
  const isbn13 = isbns.find((value) => value && value.length === 13);
  return isbn13 || isbns[0] || null;
};

const renderMeeting = (meeting) => {
  const element = document.getElementById('meeting-datetime');
  if (!meeting || (!meeting.date && !meeting.time)) {
    element.textContent = 'TBD';
    return;
  }
  const date = meeting.date || '';
  const time = meeting.time || '';
  element.textContent = [date, time].filter(Boolean).join(' at ');
};

const renderError = (message) => {
  const container = document.getElementById('errors');
  const list = document.getElementById('error-list');
  const item = document.createElement('li');
  item.textContent = message;
  list.appendChild(item);
  container.hidden = false;
};

const renderBookCard = (container, metadata) => {
  const template = document.getElementById('book-card-template');
  if (template && 'content' in template) {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector('.book-card');
    const cover = fragment.querySelector('.book-cover');
    const coverNote = fragment.querySelector('.book-cover-note');
    const title = fragment.querySelector('.book-title');
    const author = fragment.querySelector('.book-author');
    const isbn = fragment.querySelector('.book-isbn');
    const isbnNote = fragment.querySelector('.book-isbn-note');
    const meta = fragment.querySelector('.book-meta');
    const description = fragment.querySelector('.book-description');

    if (cover) {
      cover.alt = metadata.title || 'Book cover';
      cover.src = metadata.cover || '';
      if (metadata.coverSet && metadata.coverSet.length > 0) {
        cover.srcset = metadata.coverSet
          .map((item) => `${item.url} ${item.descriptor}`)
          .join(', ');
        cover.sizes = COVER_SIZES;
      }
    }
    if (coverNote) {
      coverNote.textContent = metadata.cover ? '' : 'Cover not available yet.';
      if (!coverNote.textContent) coverNote.remove();
    }
    if (title) title.textContent = metadata.title || 'Unknown title';
    if (author) author.textContent = metadata.author || 'Unknown author';
    if (isbn) {
      const isbnParts = [];
      if (metadata.isbn13) isbnParts.push(`ISBN-13: ${metadata.isbn13}`);
      if (metadata.isbn10) isbnParts.push(`ISBN-10: ${metadata.isbn10}`);
      isbn.textContent = isbnParts.join(' | ');
      if (!isbn.textContent) isbn.remove();
    }
    if (isbnNote) {
      isbnNote.textContent =
        metadata.isbnNotes && metadata.isbnNotes.length ? metadata.isbnNotes.join('. ') : '';
      if (!isbnNote.textContent) isbnNote.remove();
    }
    if (meta) {
      meta.textContent = metadata.pageCount ? `${metadata.pageCount} pages` : '';
      if (!meta.textContent) meta.remove();
    }
    if (description) {
      description.textContent = metadata.description || '';
      if (!description.textContent) description.remove();
    }

    container.appendChild(card || fragment);
    return;
  }

  const card = document.createElement('article');
  card.className = 'book-card';

  const cover = document.createElement('img');
  cover.className = 'book-cover';
  cover.alt = metadata.title || 'Book cover';
  cover.src = metadata.cover || '';
  if (metadata.coverSet && metadata.coverSet.length > 0) {
    cover.srcset = metadata.coverSet
      .map((item) => `${item.url} ${item.descriptor}`)
      .join(', ');
    cover.sizes = COVER_SIZES;
  }
  const coverNote = document.createElement('p');
  coverNote.className = 'book-cover-note';
  coverNote.textContent = metadata.cover ? '' : 'Cover not available yet.';

  const title = document.createElement('h3');
  title.className = 'book-title';
  title.textContent = metadata.title || 'Unknown title';

  const author = document.createElement('p');
  author.className = 'book-author';
  author.textContent = metadata.author || 'Unknown author';

  const isbn = document.createElement('p');
  isbn.className = 'book-isbn';
  const isbnParts = [];
  if (metadata.isbn13) isbnParts.push(`ISBN-13: ${metadata.isbn13}`);
  if (metadata.isbn10) isbnParts.push(`ISBN-10: ${metadata.isbn10}`);
  isbn.textContent = isbnParts.join(' | ');

  const isbnNote = document.createElement('p');
  isbnNote.className = 'book-isbn-note';
  isbnNote.textContent =
    metadata.isbnNotes && metadata.isbnNotes.length ? metadata.isbnNotes.join('. ') : '';

  const meta = document.createElement('p');
  meta.className = 'book-meta';
  meta.textContent = metadata.pageCount ? `${metadata.pageCount} pages` : '';

  const description = document.createElement('p');
  description.className = 'book-description';
  description.textContent = metadata.description || '';

  card.appendChild(cover);
  if (coverNote.textContent) card.appendChild(coverNote);
  card.appendChild(title);
  card.appendChild(author);
  if (isbn.textContent) card.appendChild(isbn);
  if (isbnNote.textContent) card.appendChild(isbnNote);
  if (meta.textContent) card.appendChild(meta);
  if (description.textContent) card.appendChild(description);

  container.appendChild(card);
};

const fetchFromOpenLibrary = async (book) => {
  if (!book.title && !book.author && !book.isbn10 && !book.isbn13) {
    return null;
  }

  let isbn = null;
  let coverId = null;

  const isbnDataFromBook = getIsbnData(book);
  const hasValidIsbn = Boolean(isbnDataFromBook.isbn13 || isbnDataFromBook.isbn10);
  if (hasValidIsbn) {
    isbn = isbnDataFromBook.isbn13 || isbnDataFromBook.isbn10;
  } else if (book.title || book.author) {
    const search = await fetchJson(openLibrarySearchUrl(book.title, book.author));
    const first = search.docs && search.docs[0];
    if (first) {
      isbn = selectIsbn13(first.isbn || []);
      coverId = first.cover_i || null;
    }
  }

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
  const description =
    typeof details.description === 'string'
      ? details.description
      : details.description && details.description.value
      ? details.description.value
      : null;

  const coverSelection = selectBestOpenLibraryCover(details.cover, coverId);

  return {
    title: details.title || book.title,
    author: details.authors && details.authors[0] ? details.authors[0].name : book.author,
    cover: coverSelection.url,
    coverRank: coverSelection.rank,
    coverSet: coverSelection.coverSet,
    pageCount: details.number_of_pages || null,
    description,
    isbn10: isbnData.isbn10,
    isbn13: isbnData.isbn13,
    isbnNotes: isbnData.notes,
  };
};

const fetchFromGoogleBooks = async (book, apiKey) => {
  const isbnData = getIsbnData(book);
  const hasValidIsbn = Boolean(isbnData.isbn13 || isbnData.isbn10);
  const hasQuery = hasValidIsbn || book.title || book.author;
  if (!hasQuery) {
    return null;
  }

  let query = '';
  if (hasValidIsbn) {
    query = `isbn:${isbnData.isbn13 || isbnData.isbn10}`;
  } else {
    const parts = [];
    if (book.title) parts.push(`intitle:${book.title}`);
    if (book.author) parts.push(`inauthor:${book.author}`);
    query = parts.join('+');
  }

  const data = await fetchJson(googleBooksUrl(query, apiKey));
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

const resolveBookMetadata = async (book, apiKey) => {
  try {
    const openLibrary = await fetchFromOpenLibrary(book);
    if (openLibrary) {
      const needsEnrichment =
        !openLibrary.description || !openLibrary.pageCount || !openLibrary.cover;
      if (!needsEnrichment) {
        return openLibrary;
      }
      try {
        const googleBooks = await fetchFromGoogleBooks(book, apiKey);
        if (googleBooks) {
          const useGoogleCover = googleBooks.coverRank > (openLibrary.coverRank || 0);
          return {
            ...openLibrary,
            description: openLibrary.description || googleBooks.description,
            pageCount: openLibrary.pageCount || googleBooks.pageCount,
            cover: pickBestCover(openLibrary.cover, googleBooks),
            coverSet: useGoogleCover ? googleBooks.coverSet : openLibrary.coverSet,
            isbnNotes:
              openLibrary.isbnNotes && openLibrary.isbnNotes.length
                ? openLibrary.isbnNotes
                : googleBooks.isbnNotes,
          };
        }
      } catch (error) {
        renderError(`Google Books lookup failed for "${book.title || book.isbn}".`);
      }
      return openLibrary;
    }
  } catch (error) {
    renderError(`Open Library lookup failed for "${book.title || book.isbn}".`);
  }

  try {
    const googleBooks = await fetchFromGoogleBooks(book, apiKey);
    if (googleBooks) {
      return googleBooks;
    }
  } catch (error) {
    renderError(`Google Books lookup failed for "${book.title || book.isbn}".`);
  }

  return {
    title: book.title || 'Unknown title',
    author: book.author || 'Unknown author',
    cover: '',
    pageCount: null,
  };
};

const loadPage = async () => {
  const config = await fetchJson(CONFIG_URL);

  const clubName = document.getElementById('club-name');
  clubName.textContent = config.clubName || 'Book Club';

  renderMeeting(config.nextMeeting);

  const bookContainer = document.getElementById('books');
  bookContainer.innerHTML = '';

  const apiKey = config.googleBooksApiKey || '';
  const books = Array.isArray(config.currentBooks) ? config.currentBooks : [];

  for (const book of books) {
    const metadata = await resolveBookMetadata(book, apiKey);
    renderBookCard(bookContainer, metadata);
  }
};

loadPage().catch(() => {
  renderError('Unable to load configuration.');
});

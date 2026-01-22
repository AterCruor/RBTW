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
  const card = document.createElement('article');
  card.className = 'book-card';

  const cover = document.createElement('img');
  cover.className = 'book-cover';
  cover.alt = metadata.title || 'Book cover';
  cover.src = metadata.cover || '';

  const title = document.createElement('h3');
  title.className = 'book-title';
  title.textContent = metadata.title || 'Unknown title';

  const author = document.createElement('p');
  author.className = 'book-author';
  author.textContent = metadata.author || 'Unknown author';

  const meta = document.createElement('p');
  meta.className = 'book-meta';
  meta.textContent = metadata.pageCount ? `${metadata.pageCount} pages` : '';

  card.appendChild(cover);
  card.appendChild(title);
  card.appendChild(author);
  if (meta.textContent) card.appendChild(meta);

  container.appendChild(card);
};

const fetchFromOpenLibrary = async (book) => {
  if (!book.title && !book.author && !book.isbn) {
    return null;
  }

  let isbn = null;
  let coverId = null;

  if (book.title || book.author) {
    const search = await fetchJson(openLibrarySearchUrl(book.title, book.author));
    const first = search.docs && search.docs[0];
    if (first) {
      isbn = selectIsbn13(first.isbn || []);
      coverId = first.cover_i || null;
    }
  }

  if (!isbn && book.isbn) {
    isbn = book.isbn;
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

  return {
    title: details.title || book.title,
    author: details.authors && details.authors[0] ? details.authors[0].name : book.author,
    cover:
      (details.cover && (details.cover.large || details.cover.medium)) ||
      (coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : ''),
    pageCount: details.number_of_pages || null,
  };
};

const fetchFromGoogleBooks = async (book, apiKey) => {
  const hasQuery = book.isbn || book.title || book.author;
  if (!hasQuery) {
    return null;
  }

  let query = '';
  if (book.isbn) {
    query = `isbn:${book.isbn}`;
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
  return {
    title: info.title || book.title,
    author: info.authors ? info.authors[0] : book.author,
    cover: info.imageLinks ? info.imageLinks.thumbnail : '',
    pageCount: info.pageCount || null,
  };
};

const resolveBookMetadata = async (book, apiKey) => {
  try {
    const openLibrary = await fetchFromOpenLibrary(book);
    if (openLibrary) {
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

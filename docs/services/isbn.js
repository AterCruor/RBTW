const normalizeIsbn = (value) => {
  if (!value) return null;
  const cleaned = String(value).replace(/[^0-9X]/gi, '').toUpperCase();
  return cleaned || null;
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

export const getIsbnData = (book, fallbackIsbn) => {
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

export const selectIsbn13 = (isbns = []) => {
  const isbn13 = isbns.find((value) => value && value.length === 13);
  return isbn13 || isbns[0] || null;
};

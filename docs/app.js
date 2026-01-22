import { resolveBookMetadata } from './services/bookService.js';
import { renderBookCard } from './render/bookCard.js';
import { getConfigUrl } from './utils/config.js';

const CONFIG_URL = getConfigUrl();

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

const renderErrors = (errors) => {
  if (!Array.isArray(errors) || errors.length === 0) return;
  for (const entry of errors) {
    const detail = entry && entry.error && entry.error.message ? ` (${entry.error.message})` : '';
    renderError(`${entry.message || 'Lookup failed.'}${detail}`);
  }
};

const loadPage = async () => {
  let config;
  try {
    const response = await fetch(CONFIG_URL);
    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }
    config = await response.json();
  } catch (error) {
    const detail = error && error.message ? ` (${error.message})` : '';
    renderError(`Unable to load configuration${detail}.`);
    return;
  }

  const clubName = document.getElementById('club-name');
  clubName.textContent = config.clubName || 'Book Club';

  renderMeeting(config.nextMeeting);

  const bookContainer = document.getElementById('books');
  bookContainer.innerHTML = '';

  const apiKey = config.googleBooksApiKey || '';
  const books = Array.isArray(config.currentBooks) ? config.currentBooks : [];

  try {
    for (const book of books) {
      const { metadata, errors } = await resolveBookMetadata(book, apiKey);
      renderErrors(errors);
      renderBookCard(bookContainer, metadata);
    }
  } catch (error) {
    const detail = error && error.message ? ` (${error.message})` : '';
    renderError(`Unable to render books${detail}.`);
  }
};

loadPage();

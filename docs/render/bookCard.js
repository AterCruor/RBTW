const COVER_SIZES = '(max-width: 600px) 100vw, (max-width: 960px) 50vw, 240px';

const sanitizeDescriptionHtml = (value) => {
  if (!value) return '';
  const allowedTags = new Set(['B', 'STRONG', 'I', 'EM', 'BR', 'P']);
  const template = document.createElement('template');
  template.innerHTML = String(value);
  const fragment = template.content;

  const scrubNode = (node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      if (!allowedTags.has(node.tagName)) {
        const fragment = document.createDocumentFragment();
        while (node.firstChild) fragment.appendChild(node.firstChild);
        node.replaceWith(fragment);
        return;
      }
      while (node.attributes.length > 0) {
        node.removeAttribute(node.attributes[0].name);
      }
    }
    for (const child of Array.from(node.childNodes)) {
      scrubNode(child);
    }
  };

  scrubNode(fragment);
  const wrapper = document.createElement('div');
  wrapper.appendChild(fragment.cloneNode(true));
  const cleaned = wrapper.innerHTML.trim();
  if (cleaned) return cleaned;
  return wrapper.textContent ? wrapper.textContent.trim() : '';
};

const applyMetadata = (elements, metadata) => {
  const { cover, coverNote, title, author, meta, description, quotes } = elements;

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

  if (meta) {
    meta.textContent = metadata.pageCount ? `${metadata.pageCount} pages` : '';
    if (!meta.textContent) meta.remove();
  }

  if (description) {
    const sanitized = sanitizeDescriptionHtml(metadata.description);
    description.innerHTML = sanitized;
    if (!sanitized) description.remove();
  }

  if (quotes) {
    const items = Array.isArray(metadata.quotes) ? metadata.quotes : [];
    if (items.length === 0) {
      quotes.remove();
    } else {
      quotes.innerHTML = '';
      for (const quote of items) {
        const item = document.createElement('li');
        item.textContent = quote;
        quotes.appendChild(item);
      }
    }
  }
};

export const renderBookCard = (container, metadata) => {
  const template = document.getElementById('book-card-template');
  if (template && 'content' in template) {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector('.book-card');
    const cover = fragment.querySelector('.book-cover');
    const coverNote = fragment.querySelector('.book-cover-note');
    const title = fragment.querySelector('.book-title');
    const author = fragment.querySelector('.book-author');
    const meta = fragment.querySelector('.book-meta');
    const description = fragment.querySelector('.book-description');
    const quotes = fragment.querySelector('.book-quotes');

    applyMetadata(
      { cover, coverNote, title, author, meta, description, quotes },
      metadata
    );

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

  const meta = document.createElement('p');
  meta.className = 'book-meta';

  const description = document.createElement('div');
  description.className = 'book-description';

  const quotes = document.createElement('ul');
  quotes.className = 'book-quotes';
  applyMetadata(
    { cover, coverNote, title, author, meta, description, quotes },
    metadata
  );

  card.appendChild(cover);
  if (coverNote.textContent) card.appendChild(coverNote);
  card.appendChild(title);
  card.appendChild(author);
  if (meta.textContent) card.appendChild(meta);
  if (description.innerHTML) card.appendChild(description);
  if (quotes.children.length > 0) card.appendChild(quotes);

  container.appendChild(card);
};

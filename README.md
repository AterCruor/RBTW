# RBTW Book Club MVP (Static)

Single-page, static club dashboard for GitHub Pages. It shows the current book(s) and the next meeting date/time. Book metadata is fetched client-side from Open Library, with Google Books as fallback.

## Structure

- `site/index.html`: page layout
- `site/styles.css`: styling
- `site/app.js`: client-side metadata fetch
- `site/config.json`: club configuration

## Update Workflow

1. Edit `site/config.json`.
2. Commit and push.
3. GitHub Pages publishes the update.

## Config Format

```json
{
  "clubName": "Your Book Club",
  "nextMeeting": {
    "date": "2026-02-15",
    "time": "7:00 PM"
  },
  "currentBooks": [
    {
      "title": "The Great Gatsby",
      "author": "F. Scott Fitzgerald",
      "isbn": "9780743273565"
    }
  ],
  "googleBooksApiKey": ""
}
```

Notes:
- Title/author are preferred for lookups; ISBN is used as a fallback.
- `googleBooksApiKey` is optional. Leave blank to use unauthenticated access.

## GitHub Pages

Configure GitHub Pages to serve from `/site` on the default branch.

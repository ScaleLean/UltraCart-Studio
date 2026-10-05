# Changelog

## 0.2.0

- Add the page structure editor, content map, and local revision history.
- Add Landing Studio briefs, section editing, local previews, and preparation exports. Landing projects do not create live pages.
- Add explicit native widget-ID reservation with saved receipts and interruption protection.
- Add merchant-scoped warehouse schemas, SQL dry runs, bounded execution, saved queries, and history.
- Add warehouse result filtering, sorting, charts, numeric summaries, and CSV/JSON export.
- Add warehouse connection checks and specific fixes for CLI startup, account, permission, and network failures. Include common CLI installation folders in the desktop process PATH.
- Add a searchable toolkit command and capability reference, plus read-only inspection of skill instructions from the configured toolkit installation.
- Add native macOS Apple Silicon, Windows x64, and Linux x64 portable release builds, checksums, and installation instructions.
- Require a secure Linux keyring for provider credentials. Local sample editing remains available without one.

Source tests use synthetic fixtures. Native release checks exercise the packaged worker and SQLite persistence. These checks do not establish full Windows or Omarchy desktop, OAuth, or live publishing compatibility.

## 0.1.0

- Initial local desktop workspace, sample catalog, durable conversations, existing-page draft editing, review, and preview/publish controls.

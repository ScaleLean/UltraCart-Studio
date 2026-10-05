# Contributing

Use Node.js 24 and run `npm ci` from the repository root. Start the desktop app with `npm run dev`.

Before submitting a change, run:

```sh
npm run check
npm test
npm run build
```

Keep changes focused. Describe the user-visible behavior and the checks you completed. Add tests for changes to draft handling, scope checks, credentials, recovery, and publish behavior.

Use the sample store or synthetic fixtures in tests. Do not commit merchant data, account identifiers, provider credentials, local databases, private toolkit files, or screenshots of account connections. Do not run live-store writes as part of automated tests.

Preserve the renderer and engine boundary. Keep credentials and preview access URLs out of the renderer. Agent tools must retain their merchant, storefront, and page scope. A new tool must explicitly define whether it can safely replay after an interruption.

Contributions are provided under the project's MIT license. Retain the license and attribution of any third-party source you include.

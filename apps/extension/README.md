# Extension scaffold

Build output goes to `dist/`.

Load it in Chrome as an unpacked extension:

1. open `chrome://extensions`
2. enable Developer mode
3. click **Load unpacked**
4. choose `apps/extension/dist`

The side panel stores:
- web app URL
- workspace id

The extension uses:
- `activeTab`
- `scripting`
- `sidePanel`
- `storage`

It injects the content script only when the user clicks capture.

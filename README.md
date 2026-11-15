# wa-link-generator

דף סטטי רב-לשוני (עברית, English, العربية, Русский) שמייצר קישורי וואטסאפ עם נוסח מוכן, כדי לשלוח הודעת תודה. השליחה נעשית ידנית על ידי אדם אמיתי בשמו. ההודעה נוצרת בשפה שנבחרה באתר.

A static multilingual page that builds `wa.me` links with a prefilled message. Nothing is sent automatically. The message language follows the language chosen on the page.

## How it works
- Pick a contact and topic. "Generate new wording" picks another one. Edit the text if you like, then open WhatsApp and send it yourself.
- Wording pool (`data/messages.json`): per language, 24 standalone wordings of different lengths plus 12 cores x 8 closers, with an optional greeting by name. Hundreds of neutral variants, no invented identities.
- Link text never contains commas, periods or line breaks.
- UI strings live in `i18n/strings.json`. Hebrew and Arabic render right to left.
- **Contacts are not in this repo.** They are stored in the visitor's browser (`localStorage`) or loaded from a personal link `#c=name:number`. A URL fragment is not sent to any server.

## Security
- Strict Content-Security-Policy via meta tag (no inline scripts or styles, no third-party requests), `no-referrer`.
- All dynamic text is set with `textContent` or form values, never `innerHTML`. Phone numbers are normalized to digits, text is percent-encoded.
- Unit tests cover link building and injection cases. CI runs tests and CodeQL. Dependabot watches workflow actions.
- GitHub Pages cannot set HTTP headers, so `frame-ancestors` and similar header-only protections are not available.

## MCP (for a user's own assistant)
`mcp/server.js` is a dependency-free MCP server over stdio. Run it locally with `node mcp/server.js`, for example in a client config:

    { "mcpServers": { "wa-link-generator": { "command": "node", "args": ["/path/to/wa-link-generator/mcp/server.js"] } } }

Tools: `generate_whatsapp_link` (phone, optional topic, lang, name, use_name, message) returns the link and the text; `list_topics`. The number is used only to build the link and is not stored.
Assistants that can only fetch URLs can follow `llms.txt` and `data/messages.json`.

## Add a topic or language
Edit `data/messages.json` and `i18n/strings.json` (same keys and pool shape in every language, enforced by the tests) and open a pull request.

## Develop
No build step. `python3 -m http.server` for the page, `npm test` for tests (Node 20+).

## License
MIT

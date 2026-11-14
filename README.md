# wa-link-generator

דף סטטי בעברית שמייצר קישורי וואטסאפ עם נוסח מוכן, כדי לשלוח הודעת תודה לאיש ציבור. השליחה נעשית ידנית על ידי אדם אמיתי בשמו.

A static Hebrew page that builds `wa.me` links with a prefilled message. Nothing is sent automatically.

## How it works
- Pick a contact and a topic. Press "צור נוסח חדש" for another wording. Edit the text if you like, then open WhatsApp and send it yourself.
- Messages live in `data/messages.json`: fixed variants plus openers, cores and closers that combine into hundreds of neutral wordings. No invented identities.
- Link text never contains commas, periods or line breaks.
- **Contacts are not in this repo.** They are stored in your browser (`localStorage`) or loaded from a personal link of the form `#c=name:number`. A URL fragment is not sent to any server.

## Add a topic or wording
Edit `data/messages.json` and open a pull request.

## Develop
No build step. `python3 -m http.server` and open `http://localhost:8000`.

## License
MIT

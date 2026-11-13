# Karl & Aira Wedding Invitation

A responsive, single-page wedding invitation for January 5, 2027 at 2:00 PM.

## Preview

Open `index.html` in a browser. No build step is required.

## Add the couple's media

- Replace the `.photo-placeholder` blocks in `index.html` with `<img>` elements pointing to your images in `assets/`.
- Background music uses `assets/our-song.mp3` and begins at 1:22 after the guest taps Open Invitation. It then loops and can be paused from the Music button.
- Keep images optimized for the web (WebP or JPEG, ideally under 500 KB each).

## RSVP behavior

The current RSVP preview saves the response to the guest's browser using `localStorage`. Connect the form submit handler in `script.js` to your preferred database, Google Sheet, or form endpoint before collecting live responses.

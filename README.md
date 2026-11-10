# GB Access

GB Access lets blind and low-vision players play Game Boy games with a screen reader.
It runs in Safari on iPhone, and in other web browsers too.
It reads the game's memory and tells your screen reader what is happening.
VoiceOver speaks it, and your braille display shows it.

Try it here: https://2three1y.github.io/GB-Access/

## What works now (step 1)

- Pick a Game Boy game file (.gb or .gbc) from your device.
- The page says the game's name, read from the game file itself.
- Big, labeled buttons for Up, Down, Left, Right, A, B, Start and Select.
  They are real buttons, so VoiceOver finds them.
  Double tap to press once. Double tap and hold to hold a button.
- Keyboard keys work too: arrow keys, X for A, Z for B, Enter for Start, Shift for Select, P to pause.
- A Pause and Resume button, and a Mute button.
- A "Read memory" test. Type an address like C000 and it says the number stored there.
  This is how later steps will know what is going on in a game.
- A list of past messages, so you can read them again on braille.
- A button to hide the game picture. The picture can flash, so it starts hidden
  if your device is set to reduce motion.

## No games are included

GB Access does not come with any games.
You load your own game file, called a ROM. Use a game you own.
Your game file stays on your device. It is never uploaded anywhere.

Want a free game to test with? Tobu Tobu Girl is a free, open-source Game Boy game
(code MIT, art and sound CC BY 4.0) by Tangram Games:
https://tangramgames.itch.io/tobutobugirl

## What comes next

- Step 2: Pokémon Red and Blue. Read text boxes, menus and battles out loud,
  and add a "where am I" button. The memory map comes from the pret/pokered project.
- Step 3: sound cues for walls, doors and people.

## Thanks and credits

GB Access uses the binjgb Game Boy emulator by Ben Smith.
binjgb is under the MIT license.
Its built files are in the vendor/binjgb folder, with its license.
binjgb: https://github.com/binji/binjgb

Some of the run-loop code follows binjgb's simple.js demo, which also has code from GB Studio
by Chris Maltby (MIT). That license is in vendor/binjgb/LICENSE.gbstudio.

## License

GB Access is free and open source under the GNU Affero General Public License, version 3 (AGPL-3.0).
See the LICENSE file. The binjgb files keep their own MIT license.

## For developers

It is one static page: index.html, app.js and style.css. No build step, no CDNs.
GitHub Pages serves it from the main branch.

The browser test is in test/e2e.py. It uses Playwright for Python:

    python3 -m http.server 8731
    python3 test/e2e.py http://127.0.0.1:8731/ path/to/game.gb chromium

To update binjgb, copy docs/binjgb.js and docs/binjgb.wasm from the binjgb repo
into vendor/binjgb. The current copy is from binjgb commit 16621111ed0ee73bcc45c912a823bcebedcffc0f.

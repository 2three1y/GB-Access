# GB Access

GB Access lets blind and low-vision players play Game Boy games with a screen reader.
It runs in Safari on iPhone, and in other web browsers too.
It reads the game's memory and tells your screen reader what is happening.
VoiceOver speaks it, and your braille display shows it.

Try it here: https://2three1y.github.io/GB-Access/

## What works now (step 1)

- Pick a Game Boy game file (.gb or .gbc) from your device,
  or tap the demo game button to play Tobu Tobu Girl.
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

## One demo game is included

GB Access comes with one free demo game: Tobu Tobu Girl by Tangram Games.
Tap "Play demo game: Tobu Tobu Girl" and it starts right away. You don't need a file.
Its code is under the MIT license, and its art and sound are under CC BY 4.0.
That means we are allowed to share it, as long as we give credit.
The credits and full license are in demo/CREDITS.md.
Get the game from its makers: https://tangramgames.itch.io/tobutobugirl

That is the only game that comes with GB Access.
For any other game, you load your own game file, called a ROM. Use a game you own.
Your game file stays on your device. It is never uploaded anywhere.

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

Tobu Tobu Girl, the demo game, is by Tangram Games (code MIT, art and sound CC BY 4.0).
See demo/CREDITS.md.

## License

GB Access is free and open source under the GNU Affero General Public License, version 3 (AGPL-3.0).
See the LICENSE file. The binjgb files keep their own MIT license. The demo game keeps its own licenses too.

## For developers

It is one static page: index.html, app.js and style.css. No build step, no CDNs.
GitHub Pages serves it from the main branch.

The browser test is in test/e2e.py. It uses Playwright for Python:

    python3 -m http.server 8731
    python3 test/e2e.py http://127.0.0.1:8731/ demo/tobutobugirl.gb chromium

The test also checks that the demo game button loads the game and says its name.

To update binjgb, copy docs/binjgb.js and docs/binjgb.wasm from the binjgb repo
into vendor/binjgb. The current copy is from binjgb commit 16621111ed0ee73bcc45c912a823bcebedcffc0f.

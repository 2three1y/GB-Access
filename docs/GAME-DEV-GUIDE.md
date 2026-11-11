# Make Your Game Work With Screen Readers

A guide for game devs, from a blind player who builds stuff.

## Why this matters

I'm blind and I play games with VoiceOver, TalkBack and a BrailleNote. Most games don't talk to my screen reader at all. When a game is just a picture with no text, I'm stuck on the title screen.

I can't fix other people's games. You can fix yours. A lot of the fixes are small, and they help way more people than you think.

This guide is not a rule book. Rules already exist (there are links at the end). This is just what actually works, from stuff I built and stuff other people built.

## Screen readers 101

A screen reader turns what's on the screen into speech or braille. The big ones:

- VoiceOver on iPhone, iPad and Mac
- TalkBack on Android
- NVDA and JAWS on Windows
- Braille displays, like my BrailleNote, which show text as dots I read with my fingers

A screen reader can only read real text and real controls. It can't read a picture, and it can't guess what your canvas means. So your job is to give it text.

## My proof: GB Access

I built [GB Access](https://github.com/2three1y/GB-Access). It runs Game Boy games in a web browser and tells my screen reader what's happening. Here's what I learned building it.

### Use real buttons with plain names

- Do: `<button type="button">Up</button>`
- Don't: a `<div>` with a click handler and an arrow icon

Real buttons work with tap, double tap, Enter and Space for free. Plain names win. "Up" beats "D-pad north arrow".

### Give your controls a heading

I put all the game buttons under a heading called "Controls". On iPhone, the VoiceOver rotor can jump straight to headings. So I get to the controls in one swipe instead of twenty.

- Do: `<h2>Controls</h2>` right above your buttons
- Don't: make me swipe through the whole page to find "Start"

### Announce things with aria-live, and make repeats work

An aria-live region is a spot on the page that the screen reader reads out by itself when its text changes. It's how your game talks.

The catch: if you set the same message twice, a lot of screen readers stay quiet the second time, because "nothing changed". If I bump the same wall twice, I need to hear "wall" twice.

The fix is to clear the text, wait a tiny bit, then set it:

```html
<div id="status" role="status" aria-live="polite" aria-atomic="true"></div>
```

```js
const statusEl = document.getElementById("status");
let timer;
function say(msg) {
  clearTimeout(timer);
  statusEl.textContent = "";        // clear first
  timer = setTimeout(() => {
    statusEl.textContent = msg;     // then set, so repeats get read again
  }, 150);
}
```

GB Access also adds an invisible no-break space to every other message, so the text is never exactly the same twice.

- Do: use `polite` for most stuff, so you don't cut off what I'm already hearing
- Don't: put the whole screen in a live region and change it 60 times a second. That's just noise.

### Play a click on every press

Every button press in GB Access makes a quiet click, even when the game sound is off. Without it, I can't tell if my tap counted or not. There's a "Button sounds" setting to turn it off.

### Move focus after a game loads, and say what loaded

When a game starts, GB Access moves focus to the Up button and says "Loaded", then the game's name, then "Game running. Controls ready." I know it worked, I know what game it is, and my finger is already where it needs to be.

- Do: move focus to the first control and say what loaded
- Don't: load the game silently and leave my focus on the file picker

### Make extra speech optional

There's a "Say button names" setting. When it's on, every press says the button name. It starts off, because hearing "A, A, A, A" gets old fast. Let players turn up the talking, but don't force it.

### Keep a list of past messages

Speech goes by fast. Braille users read at their own pace, and sometimes I just miss something. GB Access keeps a "Past messages" list, newest first, so I can go back and read it again.

### Make targets big

Every button is at least 44 by 44 pixels. Big targets are easier to find when you're dragging a finger around the screen, and easier to hit for everyone else too.

### Put the setting's state in its name

- Do: "Game sound: on" and "Game sound: off"
- Don't: a button called "Sound" that never tells you which way it's set

When the state is in the label, the screen reader reads it every time, no guessing.

### No flashing

Flashing can trigger seizures. GB Access can hide the game picture, and it starts hidden if your device is set to reduce motion. If your game flashes, give players a way to turn that off.

## Lessons from other access mods

Blind players and devs have been making games playable for years. These projects are where I learned most of this. Go check them out.

### Sound cues for direction and distance

Speech is slow. A sound can tell me "there's a thing to your left, kinda far" in half a second. Change the pan for left and right, and the volume or pitch for distance.

[Minecraft Access](https://github.com/minecraft-access/minecraft-access) uses a screen reader plus sound cues so you can find your way around a 3D world. [Factorio Access](https://github.com/factorio-access/FactorioAccess) has an "audio ruler" you can place to line things up.

### A "walk to" button

Finding a door by bumping into every wall is not fun. Let me pick a place from a list and walk there.

[Stardew Access](https://github.com/stardew-access/stardew-access) has an object tracker. You browse nearby objects by type and distance, and it can walk you to the one you pick. [Pokémon Access](https://github.com/nuive/pokemon-access) has a pathfind key that finds a path to the thing you chose.

### Read menus and inventory as text

Menus, bags, shops, cards and dialogue are all text in your code already. Send that text to the screen reader instead of only drawing it.

Stardew Access reads menus, dialogue, chests, health, money and the time of day. [Hearthstone Access](https://hearthstoneaccess.com/) made a whole card game playable for blind players, and it's still kept alive by its community.

### Hotkeys to check your status

Give me one key for each thing I need to check a lot. Pokémon Access has keys for the map name, your position, the text on screen, and your health and the enemy's health in a battle.

- Do: "H: say my health"
- Don't: make me open three menus to find my health

### Let me look around with a key

Let me check what's around me without moving. Stardew Access has a tile viewer that reads the tile you face, and you can move it around the map to explore. Factorio Access has a cursor you move with keys, and a key that says what's under it.

### Talk to the player's own screen reader

On Windows, [Tolk](https://github.com/dkager/tolk) is a library that sends speech and braille to NVDA, JAWS and other screen readers. Stardew Access uses it. On the web, an aria-live region does the same job. Using my screen reader means I get my own voice, my own speed and my braille display.

If you want to make a game that's built for audio from the start, check out [NVGT](https://github.com/samtupy/nvgt), the NonVisual Gaming Toolkit.

### When there's no text at all

The [RetroArch AI Service](https://docs.libretro.com/guides/ai-service/) can read text from the game screen out loud. It's a cool backup when a game has no text to give a screen reader. But it's slower and can get things wrong, so real text from your game is always better.

## Quick checklist

- Real buttons with plain names
- A "Controls" heading
- aria-live messages that clear, then set, so repeats get read
- A click or sound on every press
- Focus moves after loading, and the game says what loaded
- Extra speech is a setting, off by default
- A past-messages list for braille
- Targets at least 44 px
- Settings say their state in the label
- No flashing, or a way to turn it off
- Sound cues for direction and distance
- A "walk to" helper
- Menus and inventory sent as text
- Hotkeys for status
- A key to look around

Then test it yourself. Turn on VoiceOver or TalkBack, close your eyes, and try to play. You'll find stuff fast.

## Further reading

- [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/), a simple list of ideas, from basic to advanced
- [Xbox Accessibility Guidelines](https://learn.microsoft.com/en-us/xbox/accessibility/guidelines) from Microsoft

## Want help?

Open an issue on [GB Access](https://github.com/2three1y/GB-Access/issues) and ask. I'm happy to test stuff and tell you what works with a screen reader.

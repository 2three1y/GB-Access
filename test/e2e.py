"""GB Access browser test. Usage: python3 test/e2e.py URL ROM [chromium|webkit] [screenshot-prefix]"""
import sys, json, time, hashlib
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; ROM = sys.argv[2]; BROWSER = sys.argv[3] if len(sys.argv) > 3 else "chromium"
OUT = sys.argv[4] if len(sys.argv) > 4 else None
res = {}
def ok(name, cond, info=""):
    res[name] = {"pass": bool(cond), "info": info}
with sync_playwright() as p:
    b = getattr(p, BROWSER).launch()
    pg = b.new_page(viewport={"width": 390, "height": 844})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append("console:" + m.text) if m.type == "error" else None)
    pg.goto(URL); pg.wait_for_load_state("networkidle")
    st = lambda: pg.inner_text("#status").strip()  # strip the no-break space say() adds every other time
    ok("one_h1", pg.locator("h1").count() == 1)
    ok("lang", pg.get_attribute("html", "lang") == "en-US")
    ok("no_describedby", pg.locator("[aria-describedby]").count() == 0)
    ok("no_aria_label_links", pg.locator("a[aria-label]").count() == 0)
    ok("live_region", pg.get_attribute("#status", "aria-live") == "polite")
    # controls have their own h2 heading, and the game buttons come in order
    h2s = pg.eval_on_selector_all("h2", "hs => hs.map(h => h.textContent.trim())")
    ok("controls_heading", "Controls" in h2s and "More" in h2s, h2s)
    order = pg.eval_on_selector_all("#controls button.gb", "bs => bs.map(b => b.textContent.trim())")
    ok("controls_order", order == ["Up", "Left", "Right", "Down", "A", "B", "Start", "Select"], order)
    ok("game_buttons_before_more", pg.evaluate("""() => { const up = document.querySelector('button.gb.d-up'), p = document.getElementById('pause');
        return !!(up.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING); }"""))
    ok("no_aria_pressed", pg.locator("[aria-pressed]").count() == 0)
    # memory read before a game: says so, and again when repeated
    pg.click("#readmem"); pg.wait_for_timeout(400); m1 = st()
    pg.click("#readmem"); pg.wait_for_timeout(400); m2 = st()
    ok("memory_no_game", m1 == "Load a game first." and m2 == m1 and "Load a game first" in pg.inner_text("#memresult"), [m1, m2])
    sizes = pg.eval_on_selector_all("button", "bs => bs.map(b => [b.textContent.trim(), b.getBoundingClientRect().width, b.getBoundingClientRect().height])")
    ok("buttons_44px_and_labeled", all(w >= 44 and h >= 44 and t for t, w, h in sizes), sizes)
    gsz = pg.eval_on_selector_all("button.gb", "bs => bs.map(b => [b.getBoundingClientRect().width, b.getBoundingClientRect().height])")
    ok("game_buttons_big", all(w >= 60 and h >= 60 for w, h in gsz), gsz)
    ok("no_hscroll_390", pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth"))
    # demo game button: a real button with its name, loads the bundled game, says its title
    demo = pg.get_by_role("button", name="Play demo game: Tobu Tobu Girl")
    ok("demo_button_found", demo.count() == 1)
    demo.click()
    pg.wait_for_function("document.getElementById('status').textContent.includes('Game running')", timeout=15000)
    pg.wait_for_timeout(300)
    ok("demo_loads_and_announces", st() == "Loaded TOBU. Game running. Controls ready.", st())
    ok("focus_on_up_after_demo", pg.evaluate("document.activeElement && document.activeElement.textContent.trim()") == "Up",
       pg.evaluate("document.activeElement && document.activeElement.outerHTML.slice(0, 80)"))
    pg.wait_for_timeout(800)
    ok("demo_runs", pg.evaluate("gbAccess.running") and pg.evaluate("gbAccess.title") == "TOBU", pg.evaluate("String(gbAccess.title)"))
    # bad file
    pg.set_input_files("#rom", files=[{"name": "notes.txt", "mimeType": "text/plain", "buffer": b"hello" * 100}])
    pg.wait_for_timeout(400); ok("bad_file_message", "not a Game Boy game" in st(), st())
    pg.set_input_files("#rom", ROM)
    pg.wait_for_function("document.getElementById('status').textContent.includes('Game running')", timeout=10000)
    ok("title_announced", st(), st())
    pg.wait_for_timeout(1500)
    canvas_hash = lambda: hashlib.sha1(pg.eval_on_selector("#screen", "c => c.toDataURL()").encode()).hexdigest()
    lit = pg.eval_on_selector("#screen", "c => { const d = c.getContext('2d').getImageData(0,0,160,144).data; let n=0; for (let i=0;i<d.length;i+=4) if (d[i]+d[i+1]+d[i+2] > 30) n++; return n; }")
    ok("frames_drawn", lit > 500, lit)
    # emulator advances
    ly = [pg.evaluate("gbAccess.readMem(0xFF44)") for _ in range(5)]
    # memory demo via UI
    ok("addr_default_0134", pg.input_value("#addr") == "0134" and pg.get_attribute("#addr", "maxlength") == "4")
    ok("addr_has_visible_label", pg.locator("label[for=addr]").is_visible())
    pg.fill("#addr", "0134"); pg.click("#readmem"); pg.wait_for_timeout(400); r1 = st()
    ok("read_memory_rom_title_byte", r1 == "Address 0134 holds 84, hex 54, letter T." and r1 in pg.inner_text("#memresult"), r1)
    # same read twice: the live region must change again so VoiceOver speaks it again
    pg.evaluate("""window.__liveChanges = 0; new MutationObserver(() => window.__liveChanges++)
        .observe(document.getElementById('status'), {childList: true, characterData: true, subtree: true});""")
    pg.click("#readmem"); pg.wait_for_timeout(400); r2 = st()
    raw = [pg.evaluate("document.getElementById('status').textContent")]
    pg.click("#readmem"); pg.wait_for_timeout(400); raw.append(pg.evaluate("document.getElementById('status').textContent"))
    ok("read_memory_repeat_announces", r2 == r1 and pg.evaluate("window.__liveChanges") >= 4 and raw[0] != raw[1], [r2, pg.evaluate("window.__liveChanges"), raw])
    pg.fill("#addr", "zz"); pg.click("#readmem"); pg.wait_for_timeout(300)
    ok("read_memory_bad_input", "Type 4 hex digits" in st(), st())
    pg.fill("#addr", "C000"); pg.press("#addr", "Enter"); pg.wait_for_timeout(300)
    ok("read_memory_enter_key", "Address C000 holds" in st(), st())
    # pause / resume
    pg.click("#pause"); pg.wait_for_timeout(300)
    paused_txt = st(); h1 = canvas_hash(); pg.wait_for_timeout(500); h2 = canvas_hash()
    ok("pause_announced_and_frozen", paused_txt == "Paused." and h1 == h2 and pg.inner_text("#pause") == "Resume", [paused_txt, h1 == h2])
    pg.click("#pause"); pg.wait_for_timeout(300)
    ok("resume_announced", st() == "Game running." and pg.inner_text("#pause") == "Pause", st())
    # mute
    pg.click("#mute"); pg.wait_for_timeout(300)
    ok("mute", pg.inner_text("#mute") == "Game sound: off" and st() == "Game sound off.", st())
    c0 = pg.evaluate("gbAccess.clicks")
    pg.click("button.gb[data-key=a]"); pg.wait_for_timeout(300)
    ok("click_sound_when_muted", pg.evaluate("gbAccess.clicks") > c0, [c0, pg.evaluate("gbAccess.clicks")])
    pg.click("#mute"); pg.wait_for_timeout(300)
    ok("unmute", pg.inner_text("#mute") == "Game sound: on", pg.inner_text("#mute"))
    # button sounds toggle
    ok("button_sounds_default_on", pg.inner_text("#clicks") == "Button sounds: on", pg.inner_text("#clicks"))
    ok("play_click_no_throw", pg.evaluate("() => { try { gbAccess.playClick(false); gbAccess.playClick(true); return true; } catch (e) { return String(e); } }") is True)
    pg.click("#clicks"); pg.wait_for_timeout(300)
    c1 = pg.evaluate("gbAccess.clicks"); pg.click("button.gb[data-key=b]"); pg.wait_for_timeout(300)
    ok("button_sounds_off", pg.inner_text("#clicks") == "Button sounds: off" and pg.evaluate("gbAccess.clicks") == c1 and st() == "Button sounds off.", [pg.inner_text("#clicks"), st()])
    pg.click("#clicks"); pg.wait_for_timeout(300)
    ok("button_sounds_back_on", pg.inner_text("#clicks") == "Button sounds: on")
    # say button names toggle
    ok("names_default_off", pg.inner_text("#names") == "Say button names: off")
    pg.click("button.gb[data-key=left]"); pg.wait_for_timeout(400)
    ok("names_off_silent", st() == "Button sounds on.", st())
    pg.click("#names"); pg.wait_for_timeout(300)
    ok("names_toggle_on", pg.inner_text("#names") == "Say button names: on" and st() == "Button names on.", st())
    pg.click("button.gb[data-key=left]"); pg.wait_for_timeout(400)
    ok("names_says_button", st() == "Left", st())
    pg.click("#names"); pg.wait_for_timeout(300)
    ok("names_toggle_off", pg.inner_text("#names") == "Say button names: off")
    # buttons drive the game: press Start a few times via click, watch the picture/memory change
    pg.wait_for_timeout(1500)
    before = pg.evaluate("Array.from({length: 256}, (_, i) => gbAccess.readMem(0xC000 + i))")
    hb = canvas_hash()
    for _ in range(3):
        pg.click("button.gb[data-key=start]"); pg.wait_for_timeout(700)
    after = pg.evaluate("Array.from({length: 256}, (_, i) => gbAccess.readMem(0xC000 + i))")
    ok("start_button_changes_game", hb != canvas_hash() or before != after, [hb != canvas_hash(), sum(x != y for x, y in zip(before, after))])
    # keyboard: focus body and press keys; check joypad register reflects held key
    pg.focus("h1") if False else pg.evaluate("document.activeElement && document.activeElement.blur()")
    pg.keyboard.down("ArrowDown"); pg.wait_for_timeout(200)
    down_cls = pg.get_attribute("button.gb[data-key=down]", "class")
    pg.keyboard.up("ArrowDown"); pg.wait_for_timeout(100)
    up_cls = pg.get_attribute("button.gb[data-key=down]", "class")
    ok("keyboard_maps_to_buttons", "is-down" in down_cls.split() and "is-down" not in up_cls.split(), [down_cls, up_cls])
    # keyboard activation of an on-screen button (Tab focus + Enter)
    pg.focus("button.gb[data-key=a]"); pg.keyboard.press("Enter"); pg.wait_for_timeout(50)
    cls = pg.get_attribute("button.gb[data-key=a]", "class")
    ok("enter_on_focused_button_presses_it", "is-down" in cls.split(), cls)
    # picture toggle
    pg.click("#picture"); pg.wait_for_timeout(200); ok("picture_toggle", pg.locator("#screen-wrap").is_hidden() and "hidden" in st() and pg.inner_text("#picture") == "Game picture: hidden", st()); pg.click("#picture")
    ok("log_has_history", pg.locator("#log li").count() >= 5, pg.locator("#log li").count())
    ok("no_page_errors", not errs, errs)
    if OUT:
        pg.set_viewport_size({"width": 390, "height": 844}); pg.screenshot(path=OUT + "-mobile.png", full_page=True)
        pg.set_viewport_size({"width": 1440, "height": 900}); pg.screenshot(path=OUT + "-desktop.png", full_page=True)
    b.close()
print(json.dumps(res, indent=1))
print("ALL PASS" if all(v["pass"] for v in res.values()) else "SOME FAILED")

/*
 * GB Access - a Game Boy player that talks to screen readers.
 * Copyright (C) 2026 2three1y and GB Access contributors
 * License: AGPL-3.0-or-later. See LICENSE.
 *
 * The emulator is binjgb by Ben Smith (MIT), in vendor/binjgb.
 * The run loop, sound and picture code below follow the shape of
 * binjgb's docs/simple.js (MIT, Ben Smith; parts from GB Studio, MIT,
 * Chris Maltby). Their licenses are in vendor/binjgb/.
 */
"use strict";

const CPU_TICKS_PER_SECOND = 4194304;
const AUDIO_FRAMES = 4096;
const AUDIO_LATENCY_SEC = 0.1;
const MAX_UPDATE_SEC = 5 / 60;
const EVENT_NEW_FRAME = 1;
const EVENT_AUDIO_BUFFER_FULL = 2;
const EVENT_UNTIL_TICKS = 4;
const CGB_COLOR_CURVE = 2;
const TAP_MS = 120;

const $ = (id) => document.getElementById(id);
const statusEl = $("status");
const logEl = $("log");

// ---------- Speaking ----------
let sayTimer = 0;
function say(msg) {
  // Clear first, then set, so the same words are spoken again if repeated.
  clearTimeout(sayTimer);
  statusEl.textContent = "";
  sayTimer = setTimeout(() => { statusEl.textContent = msg; }, 60);
  const li = document.createElement("li");
  li.textContent = msg;
  logEl.prepend(li);
  while (logEl.children.length > 20) logEl.lastElementChild.remove();
}

// ---------- Cartridge header ----------
function readTitle(rom) {
  // Title lives at 0x134-0x143. Newer carts use 0x143 as the color flag
  // and 0x13F-0x142 as a maker code, so stop at the first zero byte and
  // keep only plain letters, numbers and punctuation.
  let end = 0x144;
  const cgbFlag = rom[0x143];
  if (cgbFlag === 0x80 || cgbFlag === 0xc0) end = 0x143;
  let title = "";
  for (let i = 0x134; i < end && i < rom.length; i++) {
    const c = rom[i];
    if (c === 0) break;
    if (c >= 0x20 && c <= 0x7e) title += String.fromCharCode(c);
  }
  return title.trim();
}

function looksLikeGameBoy(rom) {
  if (rom.length < 0x150) return false;
  // The Nintendo logo starts at 0x104 with CE ED 66 66.
  return rom[0x104] === 0xce && rom[0x105] === 0xed &&
         rom[0x106] === 0x66 && rom[0x107] === 0x66;
}

// ---------- Sound ----------
const AudioCtx = window.AudioContext || window.webkitAudioContext;
const audioCtx = AudioCtx ? new AudioCtx() : null;
const gain = audioCtx ? audioCtx.createGain() : null;
if (gain) gain.connect(audioCtx.destination);
let muted = false;
// On iPhone, let game sound play even with the ring switch on silent.
try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) {}
function wakeAudio() {
  if (audioCtx && audioCtx.state !== "running" && emu && !emu.paused) {
    audioCtx.resume().catch(() => {});
  }
}
["pointerdown", "click", "keydown", "touchend"].forEach((t) =>
  window.addEventListener(t, wakeAudio, true));

// ---------- Emulator ----------
let binjgb = null;
const binjgbReady = (typeof Binjgb === "function")
  ? Binjgb().then((m) => (binjgb = m))
  : Promise.reject(new Error("emulator file missing"));

let emu = null;

class Emu {
  constructor(module, romBytes) {
    this.m = module;
    const size = (romBytes.length + 0x7fff) & ~0x7fff;
    this.romPtr = module._malloc(size);
    new Uint8Array(module.HEAP8.buffer, this.romPtr, size).fill(0).set(romBytes);
    const rate = audioCtx ? audioCtx.sampleRate : 44100;
    this.e = module._emulator_new_simple(this.romPtr, size, rate, AUDIO_FRAMES, CGB_COLOR_CURVE);
    if (this.e === 0) {
      module._free(this.romPtr);
      throw new Error("bad rom");
    }
    this.canvas = $("screen");
    this.ctx2d = this.canvas.getContext("2d");
    this.image = this.ctx2d.createImageData(160, 144);
    this.paused = false;
    this.lastSec = 0;
    this.leftover = 0;
    this.audioStart = 0;
    this.raf = 0;
    this.tick = this.tick.bind(this);
  }
  buf(ptr, size) { return new Uint8Array(this.m.HEAP8.buffer, ptr, size); }
  frameBuffer() { return this.buf(this.m._get_frame_buffer_ptr(this.e), this.m._get_frame_buffer_size(this.e)); }
  audioBuffer() { return this.buf(this.m._get_audio_buffer_ptr(this.e), this.m._get_audio_buffer_capacity(this.e)); }
  start() { this.lastSec = 0; this.raf = requestAnimationFrame(this.tick); }
  stop() { cancelAnimationFrame(this.raf); this.raf = 0; }
  destroy() {
    this.stop();
    this.m._emulator_delete(this.e);
    this.m._free(this.romPtr);
  }
  tick(ms) {
    this.raf = requestAnimationFrame(this.tick);
    if (this.paused) return;
    const sec = ms / 1000;
    let delta = this.lastSec ? sec - this.lastSec : 1 / 60;
    this.lastSec = sec;
    if (delta < 0) delta = 0;
    if (delta > MAX_UPDATE_SEC) delta = MAX_UPDATE_SEC;
    const ticks = delta * CPU_TICKS_PER_SECOND + this.leftover;
    const target = this.m._emulator_get_ticks_f64(this.e) + ticks;
    this.runUntil(target);
    this.leftover = target - this.m._emulator_get_ticks_f64(this.e);
    this.ctx2d.putImageData(this.image, 0, 0);
  }
  runUntil(target) {
    for (let guard = 0; guard < 10000; guard++) {
      const ev = this.m._emulator_run_until_f64(this.e, target);
      if (ev & EVENT_NEW_FRAME) this.image.data.set(this.frameBuffer());
      if (ev & EVENT_AUDIO_BUFFER_FULL) this.pushAudio();
      if (ev & EVENT_UNTIL_TICKS) break;
    }
  }
  pushAudio() {
    if (!audioCtx || muted || audioCtx.state !== "running") return;
    const now = audioCtx.currentTime;
    if (!this.audioStart || this.audioStart < now) this.audioStart = now + AUDIO_LATENCY_SEC;
    const src = this.audioBuffer();
    const b = audioCtx.createBuffer(2, AUDIO_FRAMES, audioCtx.sampleRate);
    const l = b.getChannelData(0), r = b.getChannelData(1);
    for (let i = 0; i < AUDIO_FRAMES; i++) {
      l[i] = src[2 * i] / 255;
      r[i] = src[2 * i + 1] / 255;
    }
    const node = audioCtx.createBufferSource();
    node.buffer = b;
    node.connect(gain);
    node.start(this.audioStart);
    this.audioStart += AUDIO_FRAMES / audioCtx.sampleRate;
  }
  readMem(addr) { return this.m._emulator_read_mem(this.e, addr & 0xffff) & 0xff; }
  setKey(key, down) {
    const fn = {
      up: "_set_joyp_up", down: "_set_joyp_down", left: "_set_joyp_left",
      right: "_set_joyp_right", a: "_set_joyp_A", b: "_set_joyp_B",
      start: "_set_joyp_start", select: "_set_joyp_select",
    }[key];
    if (fn) this.m[fn](this.e, down ? 1 : 0);
  }
}

// ---------- Loading a game ----------
const pauseBtn = $("pause");

async function loadRom(bytes, name) {
  if (!looksLikeGameBoy(bytes)) {
    say("That file is not a Game Boy game. Pick a file that ends in .gb or .gbc.");
    return false;
  }
  try { await binjgbReady; } catch (e) {
    say("The emulator did not load. Try reloading the page.");
    return false;
  }
  if (emu) { emu.destroy(); emu = null; }
  try {
    emu = new Emu(binjgb, bytes);
  } catch (e) {
    say("This game could not start. The file may be broken.");
    return false;
  }
  const title = readTitle(bytes) || "an untitled game";
  emu.title = title;
  emu.start();
  pauseBtn.disabled = false;
  pauseBtn.textContent = "Pause";
  if (audioCtx && !muted) audioCtx.resume().catch(() => {});
  say("Loaded " + title + ". Game running.");
  return true;
}

$("rom").addEventListener("change", async (ev) => {
  const file = ev.target.files && ev.target.files[0];
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) {
    say("That file is too big to be a Game Boy game.");
    return;
  }
  // Read the file right here on the device. Nothing is sent anywhere.
  const bytes = new Uint8Array(await file.arrayBuffer());
  await loadRom(bytes, file.name);
});

// The demo game ships with GB Access (Tobu Tobu Girl, MIT + CC BY 4.0, see demo/CREDITS.md).
const demoBtn = $("demo");
let demoBusy = false;
demoBtn.addEventListener("click", async () => {
  // No "disabled" here: that would kick VoiceOver focus off the button.
  if (demoBusy) return;
  demoBusy = true;
  say("Loading the demo game.");
  try {
    const res = await fetch("demo/tobutobugirl.gb");
    if (!res.ok) throw new Error("HTTP " + res.status);
    const bytes = new Uint8Array(await res.arrayBuffer());
    await loadRom(bytes, "tobutobugirl.gb");
  } catch (e) {
    say("The demo game did not load. Check your internet and try again.");
  } finally {
    demoBusy = false;
  }
});

// ---------- Pause and mute ----------
function setPaused(p) {
  if (!emu) { say("No game loaded yet."); return; }
  emu.paused = p;
  emu.lastSec = 0;
  pauseBtn.textContent = p ? "Resume" : "Pause";
  if (audioCtx) { if (p) audioCtx.suspend().catch(() => {}); else if (!muted) audioCtx.resume().catch(() => {}); }
  say(p ? "Paused." : "Game running.");
}
pauseBtn.addEventListener("click", () => setPaused(emu ? !emu.paused : false));

$("mute").addEventListener("click", (ev) => {
  muted = !muted;
  ev.currentTarget.setAttribute("aria-pressed", String(muted));
  if (gain) gain.gain.value = muted ? 0 : 1;
  say(muted ? "Sound off." : "Sound on.");
});

const pictureBtn = $("picture");
function setPictureHidden(h) {
  $("screen-wrap").hidden = h;
  pictureBtn.setAttribute("aria-pressed", String(h));
}
// The game picture can flash. If the device asks for less motion, hide it.
if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) setPictureHidden(true);
pictureBtn.addEventListener("click", () => {
  const h = pictureBtn.getAttribute("aria-pressed") !== "true";
  setPictureHidden(h);
  say(h ? "Game picture hidden." : "Game picture shown.");
});

// ---------- Memory demo ----------
function parseAddr(text) {
  const t = String(text).trim().replace(/^(0x|\$)/i, "");
  if (!/^[0-9a-f]{1,4}$/i.test(t)) return null;
  return parseInt(t, 16);
}
function hex(n, w) { return n.toString(16).toUpperCase().padStart(w, "0"); }
function readAndSay() {
  const addr = parseAddr($("addr").value);
  if (addr === null) { say("Type an address in hex, from 0000 to FFFF. For example C000."); return null; }
  if (!emu) { say("Load a game first, then read memory."); return null; }
  const v = emu.readMem(addr);
  say("Address " + hex(addr, 4) + " holds " + v + ", hex " + hex(v, 2) + ".");
  return v;
}
$("readmem").addEventListener("click", readAndSay);
$("addr").addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); readAndSay(); } });

// ---------- Game Boy buttons ----------
// A click (VoiceOver double tap, Enter, Space) is a short press.
// A real finger, or VoiceOver double tap and hold, holds the button.
const held = new Set();
function press(key, down) {
  if (!emu) return;
  emu.setKey(key, down);
  document.querySelectorAll('button.gb[data-key="' + key + '"]').forEach((b) => b.classList.toggle("is-down", down));
}
function tap(key) {
  if (!emu) { say("Load a game first."); return; }
  press(key, true);
  setTimeout(() => { if (!held.has(key)) press(key, false); }, TAP_MS);
}
document.querySelectorAll("button.gb").forEach((btn) => {
  const key = btn.dataset.key;
  let pointerHeld = false;
  btn.addEventListener("pointerdown", (ev) => {
    if (ev.pointerType === "mouse" && ev.button !== 0) return;
    pointerHeld = true;
    held.add(key);
    press(key, true);
    try { btn.setPointerCapture(ev.pointerId); } catch (e) {}
  });
  const release = () => {
    if (!pointerHeld) return;
    held.delete(key);
    // Keep it down at least one tap, so quick taps still count.
    setTimeout(() => { if (!held.has(key)) press(key, false); }, TAP_MS);
  };
  btn.addEventListener("pointerup", release);
  btn.addEventListener("pointercancel", release);
  btn.addEventListener("click", (ev) => {
    if (pointerHeld) { pointerHeld = false; return; }  // finger press already sent
    tap(key);
  });
});

// ---------- Keyboard ----------
const KEYMAP = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  x: "a", X: "a", z: "b", Z: "b", Enter: "start", Shift: "select", Backspace: "select",
};
function keyTargetOk(ev) {
  const t = ev.target;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return false;
  if (t && t.tagName === "BUTTON" && (ev.key === "Enter" || ev.key === " ")) return false;
  return !ev.metaKey && !ev.ctrlKey && !ev.altKey;
}
window.addEventListener("keydown", (ev) => {
  if (!emu || !keyTargetOk(ev)) return;
  if (ev.key === "p" || ev.key === "P") { setPaused(!emu.paused); ev.preventDefault(); return; }
  const k = KEYMAP[ev.key];
  if (!k) return;
  ev.preventDefault();
  held.add(k);
  press(k, true);
});
window.addEventListener("keyup", (ev) => {
  const k = KEYMAP[ev.key];
  if (!k || !held.has(k)) return;
  held.delete(k);
  press(k, false);
});

// ---------- For tests and for step 2 ----------
window.gbAccess = {
  say,
  readTitle,
  loadRom,
  readMem: (addr) => (emu ? emu.readMem(addr) : null),
  get running() { return !!emu && !emu.paused; },
  get title() { return emu ? emu.title : null; },
};

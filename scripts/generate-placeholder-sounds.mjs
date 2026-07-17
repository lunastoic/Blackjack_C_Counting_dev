/**
 * Generates ORIGINAL placeholder sound effects as 16-bit mono WAV files
 * (22.05 kHz) under assets/audio/. Everything is synthesized from sine waves
 * and white noise — no sampled or copyrighted material. Rerunnable; replace
 * individual files with professionally produced SFX later without code changes.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 22_050;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'audio');
mkdirSync(OUT, { recursive: true });

/** Wraps float samples (−1…1) into a PCM16 mono WAV buffer. */
function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(clamped * 32_767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const seconds = (ms) => Math.round((ms / 1000) * RATE);

/** One decaying sine "blip". */
function tone(freq, ms, { volume = 0.22, decay = 6, attackMs = 4 } = {}) {
  const n = seconds(ms);
  const attack = seconds(attackMs);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const env = Math.min(1, i / Math.max(1, attack)) * Math.exp(-decay * t);
    out[i] = Math.sin(2 * Math.PI * freq * t) * env * volume;
  }
  return out;
}

/** Band-ish filtered noise "swish" (simple one-pole lowpass over white noise). */
function swish(ms, { volume = 0.16, decay = 8, cutoff = 0.25 } = {}) {
  const n = seconds(ms);
  const out = new Float64Array(n);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    // Fade in briefly then decay for a "card through air" contour.
    const env = Math.min(1, i / seconds(12)) * Math.exp(-decay * t);
    last = last + cutoff * ((Math.random() * 2 - 1) - last);
    out[i] = last * env * volume * 3;
  }
  return out;
}

/** Concatenates segments with optional gaps (ms). */
function sequence(...parts) {
  const total = parts.reduce((sum, p) => sum + (typeof p === 'number' ? seconds(p) : p.length), 0);
  const out = new Float64Array(total);
  let offset = 0;
  for (const part of parts) {
    if (typeof part === 'number') {
      offset += seconds(part);
    } else {
      out.set(part, offset);
      offset += part.length;
    }
  }
  return out;
}

/** Mixes segments starting at the same time. */
function mix(...parts) {
  const total = Math.max(...parts.map((p) => p.length));
  const out = new Float64Array(total);
  for (const part of parts) {
    for (let i = 0; i < part.length; i++) {
      out[i] += part[i];
    }
  }
  return out;
}

const SOUNDS = {
  'card-deal.wav': swish(140, { decay: 14 }),
  'card-flip.wav': mix(swish(70, { decay: 30, cutoff: 0.5, volume: 0.12 }), tone(1500, 60, { volume: 0.08, decay: 40 })),
  'chip-tap.wav': mix(tone(1900, 70, { volume: 0.14, decay: 45 }), tone(950, 90, { volume: 0.1, decay: 35 })),
  'bet-placed.wav': sequence(tone(760, 90, { decay: 22 }), 20, tone(1020, 120, { decay: 18 })),
  'win.wav': sequence(tone(523, 130, { decay: 12 }), 0, tone(659, 130, { decay: 12 }), 0, tone(784, 240, { decay: 8 })),
  'loss.wav': sequence(tone(392, 160, { decay: 10, volume: 0.18 }), 10, tone(294, 280, { decay: 7, volume: 0.18 })),
  'push.wav': tone(494, 220, { decay: 10, volume: 0.16 }),
  'level-up.wav': sequence(
    tone(523, 110, { decay: 14 }), 0, tone(659, 110, { decay: 14 }), 0,
    tone(784, 110, { decay: 14 }), 0, tone(1047, 300, { decay: 7 }),
  ),
  'achievement-unlock.wav': sequence(tone(1175, 120, { decay: 14, volume: 0.16 }), 10, tone(1568, 260, { decay: 9, volume: 0.16 })),
  'shuffle.wav': sequence(swish(180, { decay: 10 }), 30, swish(160, { decay: 12 }), 30, swish(220, { decay: 9 })),
  'button-tap.wav': tone(1250, 55, { volume: 0.1, decay: 55 }),
};

for (const [name, samples] of Object.entries(SOUNDS)) {
  writeFileSync(join(OUT, name), wav(samples));
}
console.log(`Wrote ${Object.keys(SOUNDS).length} placeholder sounds to assets/audio/`);

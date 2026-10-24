"""Synthesises the game's sound effects and exports .ogg + .mp3 via ffmpeg.

Usage: python3 scripts/generate_audio.py   (needs numpy and ffmpeg)
"""
import os
import subprocess
import tempfile
import wave

import numpy as np

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'audio')


def t(d):
    return np.linspace(0, d, int(SR * d), endpoint=False)


def env(x, attack=0.005, release=0.1):
    n = len(x)
    e = np.ones(n)
    a = max(1, int(SR * attack))
    r = max(1, min(n, int(SR * release)))
    e[:a] = np.linspace(0, 1, a)
    e[-r:] *= np.linspace(1, 0, r)
    return x * e


def tone(freq, d, kind='sine', decay=6.0):
    tt = t(d)
    f = freq if np.isscalar(freq) else freq(tt)
    phase = 2 * np.pi * np.cumsum(np.broadcast_to(f, tt.shape)) / SR
    if kind == 'sine':
        w = np.sin(phase)
    elif kind == 'tri':
        w = 2 / np.pi * np.arcsin(np.sin(phase))
    else:
        w = np.sign(np.sin(phase)) * 0.5
    return w * np.exp(-decay * tt)


def noise(d, decay=20.0, lp=0.0):
    n = np.random.default_rng(7).uniform(-1, 1, int(SR * d))
    if lp:
        a = lp
        y = np.zeros_like(n)
        for i in range(1, len(n)):
            y[i] = a * y[i - 1] + (1 - a) * n[i]
        n = y / (np.max(np.abs(y)) + 1e-9)
    return n * np.exp(-decay * t(d))


def seq(*parts, gap=0.0):
    out = []
    for p in parts:
        out.append(p)
        if gap:
            out.append(np.zeros(int(SR * gap)))
    return np.concatenate(out)


def mix(*parts):
    n = max(len(p) for p in parts)
    out = np.zeros(n)
    for p in parts:
        out[: len(p)] += p
    return out


SOUNDS = {
    'sfx_move': lambda: env(mix(tone(lambda x: 220 - 120 * x / 0.12, 0.12, decay=25), 0.4 * noise(0.06, 60, 0.6))),
    'sfx_carrot_gain': lambda: env(seq(tone(880, 0.09, decay=12), tone(1318.5, 0.18, decay=10)), release=0.08),
    'sfx_carrot_lose': lambda: env(tone(lambda x: 180 - 60 * x / 0.2, 0.2, 'tri', decay=12)),
    'sfx_lettuce_chew': lambda: env(seq(*(0.8 * noise(0.07, 35, 0.2) for _ in range(3)), gap=0.04)),
    'sfx_hare_draw': lambda: env(0.7 * noise(0.22, 9, 0.85) * np.sin(np.linspace(0, np.pi, int(SR * 0.22)))),
    'sfx_hare_good': lambda: env(seq(tone(784, 0.08, decay=10), tone(988, 0.08, decay=10), tone(1175, 0.22, decay=7))),
    'sfx_hare_bad': lambda: env(seq(tone(440, 0.12, 'tri', 8), tone(370, 0.12, 'tri', 8), tone(294, 0.28, 'tri', 5))),
    'sfx_finish': lambda: env(seq(tone(523, 0.12, 'tri', 5), tone(659, 0.12, 'tri', 5), tone(784, 0.12, 'tri', 5),
                                  mix(tone(1047, 0.55, 'tri', 3), 0.5 * tone(784, 0.55, 'sine', 3))), release=0.2),
    'sfx_invalid': lambda: env(0.6 * tone(140, 0.18, 'square', 6)),
    'sfx_button_click': lambda: env(mix(tone(1600, 0.03, decay=80), 0.3 * noise(0.02, 120)), release=0.01),
    'sfx_turn_start': lambda: env(0.6 * noise(0.35, 4, 0.92) * np.sin(np.linspace(0, np.pi, int(SR * 0.35)))),
    'sfx_backward': lambda: env(tone(lambda x: 300 + 500 * np.sin(np.pi * x / 0.35) * (1 - x / 0.35), 0.35, decay=4)),
}


def write_wav(path, data):
    data = data / (np.max(np.abs(data)) + 1e-9) * 0.8
    pcm = (data * 32767).astype(np.int16)
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def main():
    os.makedirs(OUT, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for key, make in SOUNDS.items():
            wav = os.path.join(tmp, key + '.wav')
            write_wav(wav, make())
            for ext, args in (('ogg', ['-c:a', 'libvorbis', '-q:a', '4']), ('mp3', ['-c:a', 'libmp3lame', '-b:a', '96k'])):
                subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, *args, os.path.join(OUT, f'{key}.{ext}')], check=True)
            print('wrote', key)


if __name__ == '__main__':
    main()

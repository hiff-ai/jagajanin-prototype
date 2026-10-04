"""Generate the six synthetic sweep clips shown for seeded demo cases (data/demo-sweeps/).

    python3 make_demo_sweeps.py        # needs numpy, Pillow and ffmpeg

They only look like an ultrasound sweep: speckle in a sector fan with a fetal-like structure
drifting across as the probe moves. Every frame is labelled as a simulation; no patient data.
"""
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H, FPS, SECONDS = 480, 360, 15, 3
OUT = Path(__file__).parent / "data" / "demo-sweeps"


def blur(a, k=3):
    for axis in (0, 1):
        a = sum(np.roll(a, s, axis) for s in range(-k, k + 1)) / (2 * k + 1)
    return a


def clip(n, rng):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    ax, ay, R, half = W / 2, 10, H - 18, 0.74
    ang = np.arctan2(yy - ay, xx - ax)
    rad = np.hypot(xx - ax, yy - ay)
    fan = (np.abs(ang - np.pi / 2) < half) & (rad < R)
    field = blur(rng.rayleigh(0.55, (H + 40, W * 3)).astype(np.float32), 1)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 15)
    except OSError:
        font = ImageFont.load_default()
    frames = []
    for i in range(FPS * SECONDS):
        p = i / (FPS * SECONDS - 1)
        ox = int(p * W * 1.6)
        img = field[20:20 + H, ox:ox + W] * 150 + 25
        img += rng.normal(0, 8, img.shape)                      # live shimmer
        cx = W * (1.1 - p * 1.0) + (0 if n % 2 else -40)
        cy = H * (0.56 + 0.05 * np.sin(n))
        e = ((xx - cx) / (W * 0.34)) ** 2 + ((yy - cy) / (H * 0.2)) ** 2
        fluid = 1 / (1 + np.exp((e - 1) * 9))
        img = img * (1 - 0.8 * fluid)                           # amniotic fluid (soft edge)
        ring = np.abs(((xx - cx - 12) / (W * 0.15)) ** 2 + ((yy - cy) / (H * 0.11)) ** 2 - 1)
        img += 130 * np.exp(-(ring / 0.16) ** 2) * (0.75 + 0.25 * np.sin(xx / 7))   # fetal skull / body outline
        body = ((xx - cx + 95) / (W * 0.16)) ** 2 + ((yy - cy - 30) / (H * 0.07)) ** 2
        img += 55 * np.exp(-((body - 1) / 0.35) ** 2) * (n % 2)
        img += 70 * np.exp(-((yy - (ay + 34 + 6 * (n % 3))) / 9) ** 2)   # uterine wall / placenta band
        img *= np.clip(1.15 - rad / R * 0.75, 0.25, 1)          # depth attenuation
        img = np.where(fan, np.clip(img, 0, 255), 0).astype(np.uint8)
        im = Image.fromarray(img).convert("RGB")
        d = ImageDraw.Draw(im)
        d.text((10, H - 24), f"SIMULASI · Sisiran {n} · bukan data pasien", fill=(255, 211, 77), font=font)
        frames.append(im.tobytes())
    return frames


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(42)
    for n in range(1, 7):
        path = OUT / f"sweep_{n}.webm"
        ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                               "-r", str(FPS), "-i", "-", "-c:v", "libvpx-vp9", "-b:v", "500k", "-g", "5", "-pix_fmt", "yuv420p",
                               str(path)], stdin=subprocess.PIPE)
        for f in clip(n, rng):
            ff.stdin.write(f)
        ff.stdin.close()
        ff.wait()
        print(path, path.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()

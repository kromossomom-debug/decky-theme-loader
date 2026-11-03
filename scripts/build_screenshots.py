#!/usr/bin/env python3
"""Normalizes store screenshots ("prints") and generates thumbnails.

Reads every image in assets/raw/<plugin>/ and writes:
  assets/screenshots/<plugin>/<name>.jpg  1280x800 (16:10, Steam Deck resolution)
  assets/thumbs/<plugin>/<name>.jpg       480x300 (cards, filmstrip and covers)

Images that are not already 1280x800 (toasts, crops, collages) are placed on a
branded gradient stage with rounded corners and a soft drop shadow so every
print in the store has the same frame. Requires ffmpeg.
"""
import json
import os
import shutil
import struct
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "assets", "raw")
FULL = os.path.join(ROOT, "assets", "screenshots")
THUMBS = os.path.join(ROOT, "assets", "thumbs")
W, H = 1280, 800
TW, TH = 480, 300

# Stage gradient per plugin (top-left -> bottom-right)
STAGE_COLORS = {
    "ps3-dashboard": ("2a5298", "0b1630"),
    "ps5-dashboard": ("0050b8", "000c26"),
    "switch2-dashboard": ("c4101c", "1a1a2e"),
    "xbox-dashboard": ("138a13", "07170a"),
    "xbox360-dashboard": ("5dc21e", "0d2a06"),
    "xbox360-nxe-dashboard": ("a8d94a", "2d5a0c"),
    "achievo": ("8a6a18", "141008"),
}
DEFAULT_STAGE = ("24324a", "0b0e14")


def jpeg_size(path):
    with open(path, "rb") as f:
        data = f.read()
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return struct.unpack(">II", data[16:24])
    i = 2
    while i < len(data):
        marker = data[i + 1]
        length = struct.unpack(">H", data[i + 2:i + 4])[0]
        if marker in (0xC0, 0xC1, 0xC2):
            h, w = struct.unpack(">HH", data[i + 5:i + 9])
            return w, h
        i += 2 + length
    raise ValueError(f"Unknown image size: {path}")


def ffmpeg(args):
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", *args], check=True)


def stage(src, dst, colors):
    c0, c1 = colors
    radius = 18
    rounded = (
        "format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':"
        f"a='if(gt(abs(W/2-X),W/2-{radius})*gt(abs(H/2-Y),H/2-{radius}),"
        f"if(lte(hypot({radius}-(W/2-abs(W/2-X)),{radius}-(H/2-abs(H/2-Y))),{radius}),255,0),255)'"
    )
    graph = (
        f"gradients=s={W}x{H}:c0=0x{c0}:c1=0x{c1}:x0=0:y0=0:x1={W}:y1={H}:nb_colors=2:d=1:r=1,"
        f"trim=end_frame=1,vignette=PI/4[bg];"
        f"[0:v]scale=w='min(1060,iw*1.7)':h='min(640,ih*1.7)':force_original_aspect_ratio=decrease:flags=lanczos,"
        f"{rounded},split[fg][sh0];"
        f"[sh0]colorchannelmixer=rr=0:gg=0:bb=0:aa=0.6,pad=iw+120:ih+120:60:60:color=black@0,boxblur=26:2[sh];"
        f"[bg][sh]overlay=(W-w)/2:(H-h)/2+16[bg2];"
        f"[bg2][fg]overlay=(W-w)/2:(H-h)/2,format=yuvj420p"
    )
    ffmpeg(["-i", src, "-filter_complex", graph, "-frames:v", "1", "-q:v", "3", dst])


def main():
    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg not found")
    for d in (FULL, THUMBS):
        shutil.rmtree(d, ignore_errors=True)
    report = {}
    for plugin in sorted(os.listdir(RAW)):
        src_dir = os.path.join(RAW, plugin)
        if not os.path.isdir(src_dir):
            continue
        os.makedirs(os.path.join(FULL, plugin))
        os.makedirs(os.path.join(THUMBS, plugin))
        for fn in sorted(os.listdir(src_dir)):
            if not fn.lower().endswith((".jpg", ".jpeg", ".png")):
                continue
            src = os.path.join(src_dir, fn)
            out_name = os.path.splitext(fn)[0] + ".jpg"
            full = os.path.join(FULL, plugin, out_name)
            w, h = jpeg_size(src)
            if (w, h) == (W, H) and fn.lower().endswith((".jpg", ".jpeg")):
                shutil.copyfile(src, full)
            elif abs(w / h - W / H) < 0.01 and w >= W:
                ffmpeg(["-i", src, "-vf", f"scale={W}:{H}:flags=lanczos", "-q:v", "3", full])
            else:
                stage(src, full, STAGE_COLORS.get(plugin, DEFAULT_STAGE))
            ffmpeg(["-i", full, "-vf", f"scale={TW}:{TH}:flags=lanczos", "-q:v", "5",
                    os.path.join(THUMBS, plugin, out_name)])
            report.setdefault(plugin, []).append(out_name)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()

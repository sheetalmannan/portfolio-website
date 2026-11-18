"""Turn a generated portrait into the CRT texture the site loads (site/img/portrait.png).

    python3 -I source-assets/prep_portrait.py path/to/generated.png            # writes site/img/portrait.png
    python3 -I source-assets/prep_portrait.py in.png out.png --top 0.1 --zoom 1.15

What the site expects, and what this script produces:
  - square, 1024 x 1024, 8-bit greyscale PNG (the shader ignores colour and renders luminance as teal phosphor)
  - a shoulders-up portrait, head in the upper-middle, on black: black is "no signal", so the figure floats
  - full tonal range, soft falloff to black at the edges

The source must be a synthetic, fictional adult (an image-generator output or a 3D render), never a photo
of a real person and never an unlicensed stock photograph. Needs numpy + Pillow.
"""
import argparse
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

SIZE = 1024

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('source')
    ap.add_argument('output', nargs='?', default='site/img/portrait.png')
    ap.add_argument('--top', type=float, default=0.15, help='vertical crop position, 0 = keep the top, 1 = keep the bottom')
    ap.add_argument('--left', type=float, default=0.5, help='horizontal crop position, 0 = left, 1 = right')
    ap.add_argument('--zoom', type=float, default=1.0, help='crop tighter than the full short side (1.2 = 20%% closer)')
    ap.add_argument('--vignette', type=float, default=0.8, help='0 = none, 1 = strong falloff to black at the edges')
    ap.add_argument('--box', help='crop the source first: left,top,right,bottom in source pixels (e.g. to leave out hands or props)')
    ap.add_argument('--drop-background', type=int, default=0, metavar='TOLERANCE',
                    help='turn a plain studio backdrop black: flood from the top and side edges over similar colours (try 60 to 90)')
    ap.add_argument('--smooth', type=float, default=0, help='blur radius in source pixels, to remove a printed or screen dot pattern')
    ap.add_argument('--erase', help='paint a polygon black before cropping, in source pixels: "x,y x,y x,y ..." (e.g. a prop)')
    ap.add_argument('--soften-face', help='blur an ellipse so the person cannot be identified: cx,cy,rx,ry,blur in source pixels')
    ap.add_argument('--face-gain', type=float, default=1.0, help='brightness of the softened face area (above 1 keeps the head the brightest shape)')
    ap.add_argument('--compress', type=float, default=0, help='pull highlights down and mid-tones up so no one bright patch dominates (0.3 is moderate)')
    ap.add_argument('--lift', type=float, default=1.0, help='gamma for the figure: below 1 brightens dark clothing and hair (0.7 is a clear lift)')
    ap.add_argument('--peak', type=float, default=1.0, help='brightest value in the result (0.7 keeps skin and white clothing below the screen\'s clipping point)')
    ap.add_argument('--fade-bottom', type=float, default=0, help='fade the bottom fraction of the crop to black (0.2 = last 20%%)')
    args = ap.parse_args()

    im = Image.open(args.source)
    if im.mode in ('RGBA', 'LA', 'P'):          # transparent background becomes black
        im = im.convert('RGBA')
        black = Image.new('RGBA', im.size, (0, 0, 0, 255))
        im = Image.alpha_composite(black, im)
    im = im.convert('RGB')
    if args.box:
        im = im.crop(tuple(int(v) for v in args.box.split(',')))
    if args.smooth > 0:
        im = im.filter(ImageFilter.GaussianBlur(args.smooth))
    if args.drop_background > 0:
        # flood the backdrop from the top and upper side edges, then feather the cut so hair keeps a soft edge
        probe = im.filter(ImageFilter.GaussianBlur(3))
        marker = (255, 0, 255)
        w, h = probe.size
        seeds = [(x, 1) for x in range(2, w - 2, max(1, w // 24))]
        seeds += [(x, y) for y in range(2, int(h * 0.55), max(1, h // 24)) for x in (1, w - 2)]
        for seed in seeds:
            if probe.getpixel(seed) != marker:
                ImageDraw.floodfill(probe, seed, marker, thresh=args.drop_background)
        keep = (np.asarray(probe) != np.array(marker)).any(axis=2).astype(np.uint8) * 255
        if args.soften_face:   # the face is never backdrop: stop the flood eating into it through the hair parting
            fx, fy, frx, fry = (float(v) for v in args.soften_face.split(',')[:4])
            bx, by = (int(v) for v in args.box.split(',')[:2]) if args.box else (0, 0)
            guard = Image.fromarray(keep, 'L')
            ImageDraw.Draw(guard).ellipse((fx - bx - frx, fy - by - fry, fx - bx + frx, fy - by + fry), fill=255)
            keep = np.asarray(guard)
        mask = Image.fromarray(keep, 'L').filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(4))
        im = Image.composite(im, Image.new('RGB', im.size, (0, 0, 0)), mask)
    ox, oy = (int(v) for v in args.box.split(',')[:2]) if args.box else (0, 0)   # later steps take source pixels
    if args.soften_face:   # after the backdrop cut: a blurred face is too close in tone to a grey backdrop
        cx, cy, rx, ry, blur = (float(v) for v in args.soften_face.split(','))
        cx, cy = cx - ox, cy - oy
        area = Image.new('L', im.size, 0)
        ImageDraw.Draw(area).ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=255)
        area = area.filter(ImageFilter.GaussianBlur(blur * 0.8))     # no visible edge to the blurred region
        soft = ImageEnhance.Brightness(im.filter(ImageFilter.GaussianBlur(blur))).enhance(args.face_gain)
        im = Image.composite(soft, im, area)
    if args.erase:      # after the backdrop cut, so the black patches cannot seed the flood
        patch = Image.new('L', im.size, 0)
        for poly in args.erase.split('|'):          # several polygons: separate them with |
            ImageDraw.Draw(patch).polygon([(float(pt.split(',')[0]) - ox, float(pt.split(',')[1]) - oy) for pt in poly.split()], fill=255)
        im = Image.composite(Image.new('RGB', im.size, (0, 0, 0)), im, patch.filter(ImageFilter.GaussianBlur(5)))
    im = im.convert('L')

    side = int(min(im.size) / max(args.zoom, 1.0))
    x = int((im.width - side) * min(max(args.left, 0), 1))
    y = int((im.height - side) * min(max(args.top, 0), 1))
    im = im.crop((x, y, x + side, y + side)).resize((SIZE, SIZE), Image.LANCZOS)

    a = np.asarray(im, dtype=np.float32) / 255.0
    lo, hi = np.percentile(a, 0.5), np.percentile(a, 99.6)     # stretch to the full range
    a = np.clip((a - lo) / max(hi - lo, 1e-4), 0, 1)
    if args.compress > 0:
        a = a * (1 + args.compress) / (a + args.compress)
    if args.lift != 1.0:
        a = a ** args.lift
    a *= args.peak
    if args.fade_bottom > 0:
        ramp = np.clip((1 - np.linspace(0, 1, SIZE)) / args.fade_bottom, 0, 1)
        a *= (ramp * ramp * (3 - 2 * ramp))[:, None]
    if args.vignette > 0:
        yy, xx = np.mgrid[0:SIZE, 0:SIZE] / (SIZE - 1) - 0.5
        r = np.sqrt((xx * 1.05) ** 2 + (yy * 0.92) ** 2)
        fall = np.clip((0.56 - r) / 0.2, 0, 1)
        fall = fall * fall * (3 - 2 * fall)
        a *= 1 - args.vignette * (1 - fall)
    Image.fromarray((a * 255 + 0.5).astype(np.uint8), 'L').save(args.output, optimize=True)
    print(f'wrote {args.output} ({SIZE}x{SIZE}, greyscale)')

if __name__ == '__main__':
    main()

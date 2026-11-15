#!/usr/bin/env python3
"""
Builds source-assets/cyberdeck-sm01.glb from the untouched download source-assets/cyberdeck.glb.

Changes made (all recorded in CREDITS.md, as CC BY 4.0 requires):
  1. The painted "Netlight" lettering on the keyboard deck is replaced with "SM-01".
     The lettering lives in two textures of the single shared material: the base colour
     and the occlusion/roughness/metal map. Both are repainted in place, keeping the
     original paint colour, finish and wear. The normal and emissive maps have no lettering.
  2. The main CRT glass (one UV island inside the mesh under `comp_low`) is split out into
     its own mesh `crt_screen` with its own material `crt_screen` and its own 0-1 UVs,
     so screen content can be swapped or given a shader without touching the monitor.
  3. The six mesh nodes, all called `defaultMaterial`, are renamed after their parent
     (`comp_low`, `key_low`, `scope_low`, `pipes_low`, `pipes2_low`, `cool_low`).

Run:  python3 -I source-assets/build_cyberdeck.py      (needs numpy and Pillow)
Then: npx @gltf-transform/cli@4.1.1 optimize source-assets/cyberdeck-sm01.glb public/models/cyberdeck-web.glb \
        --compress meshopt --texture-compress webp --texture-size 2048 --simplify false --join false --prune-attributes false
"""
import io, json, struct
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

HERE = Path(__file__).resolve().parent
SRC = HERE / 'cyberdeck.glb'
OUT = HERE / 'cyberdeck-sm01.glb'

LABEL = 'SM-01'
FONT = '/System/Library/Fonts/Supplemental/Arial Black.ttf'
# Bounding box of the old lettering in the 4096 px atlas (x0, y0, x1, y1), measured from the base colour map
TEXT_BOX = (594, 70, 656, 350)
# A point inside the main CRT's UV island (the dark panel with yellow read-outs in the atlas)
CRT_UV_SEED = (0.55, 0.663)

# ── read the GLB ────────────────────────────────────────────────────────────
raw = SRC.read_bytes()
json_len = struct.unpack('<I', raw[12:16])[0]
gltf = json.loads(raw[20:20 + json_len])
BIN = 20 + json_len + 8
views = gltf['bufferViews']
chunks = [raw[BIN + v.get('byteOffset', 0): BIN + v.get('byteOffset', 0) + v['byteLength']] for v in views]

NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
DTYPE = {5126: np.float32, 5125: np.uint32, 5123: np.uint16}

def read_accessor(i):
    a = gltf['accessors'][i]
    n, dt = NCOMP[a['type']], DTYPE[a['componentType']]
    item = np.dtype(dt).itemsize * n
    stride = views[a['bufferView']].get('byteStride', item)
    data = np.frombuffer(chunks[a['bufferView']], dtype=np.uint8)
    off = a.get('byteOffset', 0)
    out = np.lib.stride_tricks.as_strided(data[off:], shape=(a['count'], item), strides=(stride, 1)).copy().view(dt)
    return out.reshape(-1, n) if n > 1 else out.reshape(-1)

def add_view(data, target=None):
    chunks.append(bytes(data))
    v = {'buffer': 0, 'byteLength': len(data)}
    if target:
        v['target'] = target
    views.append(v)
    return len(views) - 1

def add_accessor(arr, kind, component, target=None, minmax=False):
    arr = np.ascontiguousarray(arr)
    a = {'bufferView': add_view(arr.tobytes(), target), 'componentType': component, 'count': len(arr), 'type': kind}
    if minmax:
        a['min'], a['max'] = arr.min(0).tolist(), arr.max(0).tolist()
    gltf['accessors'].append(a)
    return len(gltf['accessors']) - 1

def node_matrix(n):
    if 'matrix' in n:
        return np.array(n['matrix']).reshape(4, 4).T
    x, y, z, w = n.get('rotation', [0, 0, 0, 1])
    R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                  [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                  [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    M = np.eye(4)
    M[:3, :3] = R * np.array(n.get('scale', [1, 1, 1]))
    M[:3, 3] = n.get('translation', [0, 0, 0])
    return M

WORLD = {}
def walk(i, parent):
    WORLD[i] = parent @ node_matrix(gltf['nodes'][i])
    for c in gltf['nodes'][i].get('children', []):
        walk(c, WORLD[i])
for root in gltf['scenes'][0]['nodes']:
    walk(root, np.eye(4))

# ── 1. repaint the lettering ────────────────────────────────────────────────
def load_image(index):
    return Image.open(io.BytesIO(chunks[gltf['images'][index]['bufferView']])).convert('RGB')

def label_mask(length, height):
    """The new label as it reads on the casing: bold, slanted, with stencil bridges like the original."""
    scale = 4
    font = ImageFont.truetype(FONT, int(height * scale * 1.02))
    probe = ImageDraw.Draw(Image.new('L', (10, 10)))
    spacing = int(height * scale * 0.06)
    # lay glyphs out one by one so each can get its own stencil bridge
    glyphs, x = [], 0
    for ch in LABEL:
        l, t, r, b = probe.textbbox((0, 0), ch, font=font)
        glyphs.append((ch, x - l, l, t, r, b))
        x += (r - l) + spacing
    width = x - spacing
    top = min(g[3] for g in glyphs if g[0] != '-')
    bottom = max(g[5] for g in glyphs if g[0] != '-')
    img = Image.new('L', (width + 40 * scale, bottom - top + 8 * scale), 0)
    d = ImageDraw.Draw(img)
    ox, oy = 20 * scale, 4 * scale - top
    for ch, gx, l, t, r, b in glyphs:
        d.text((ox + gx, oy), ch, font=font, fill=255)
        if ch in 'SM0':   # stencil bridge through the middle of the round and wide glyphs
            cx = ox + gx + (l + r) / 2
            d.rectangle([cx - 1.6 * scale, 0, cx + 1.6 * scale, img.height], fill=0)
    # slant it (the old lettering leaned about 12 degrees) and scale down with antialiasing
    shear = 0.21
    img = img.transform(img.size, Image.AFFINE, (1, shear, -shear * img.height / 2, 0, 1, 0), Image.BICUBIC)
    img = img.crop(img.getbbox())
    ratio = height / img.height
    img = img.resize((max(1, round(img.width * ratio)), height), Image.LANCZOS)
    canvas = Image.new('L', (length, height), 0)
    canvas.paste(img, ((length - img.width) // 2, 0))
    return canvas

def repaint(index, fmt):
    img = load_image(index)
    a = np.asarray(img).astype(np.float32)
    x0, y0, x1, y1 = TEXT_BOX
    pad = 10
    X0, X1 = x0 - pad, x1 + pad
    # the old paint, detected against the base colour map (cyan paint on beige casing)
    base = np.asarray(load_image(0)).astype(np.float32)
    old = ((base[:, :, 2] - base[:, :, 0]) > 12)
    old_mask = np.zeros(a.shape[:2], bool)
    old_mask[y0 - 4:y1 + 4, x0 - 4:x1 + 4] = old[y0 - 4:y1 + 4, x0 - 4:x1 + 4]
    paint = np.median(a[old_mask], axis=0)
    # erase: bridge each row across the lettering band, then put back fine grain from the clean casing beside it
    out = a.copy()
    left = a[y0 - pad:y1 + pad, X0 - 6:X0].mean(1)
    right = a[y0 - pad:y1 + pad, X1:X1 + 6].mean(1)
    t = np.linspace(0, 1, X1 - X0)[None, :, None]
    fill = left[:, None, :] * (1 - t) + right[:, None, :] * t
    donor = a[y0 - pad:y1 + pad, X1 + 8:X1 + 8 + (X1 - X0)]
    blurred = np.asarray(Image.fromarray(donor.astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))).astype(np.float32)
    fill = fill + (donor - blurred)
    grown = np.asarray(Image.fromarray((old_mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(2))).astype(np.float32) / 255
    g = grown[y0 - pad:y1 + pad, X0:X1, None]
    out[y0 - pad:y1 + pad, X0:X1] = out[y0 - pad:y1 + pad, X0:X1] * (1 - g) + fill * g
    # paint the new label. On the casing the text reads after rotating the atlas 90 degrees clockwise and
    # flipping it top to bottom, so the label gets the inverse: flip top to bottom, then rotate 90 degrees anticlockwise.
    length, height = y1 - y0, x1 - x0
    m = label_mask(length, height)
    m = ImageOps.flip(m).transpose(Image.ROTATE_90)
    m = np.asarray(m).astype(np.float32)[:, :, None] / 255
    region = out[y0:y1, x0:x1]
    # keep the wear: the paint picks up a little of the casing grain underneath it
    grain = (region - region.mean((0, 1))) * 0.35
    out[y0:y1, x0:x1] = region * (1 - m) + (paint + grain) * m
    buf = io.BytesIO()
    result = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
    if fmt == 'JPEG':
        result.save(buf, 'JPEG', quality=95, subsampling=0)
    else:
        result.save(buf, 'PNG', optimize=True)
    chunks[gltf['images'][index]['bufferView']] = buf.getvalue()
    views[gltf['images'][index]['bufferView']]['byteLength'] = len(buf.getvalue())
    print(f'image {index}: lettering repainted, paint value {paint.round().tolist()}')

mat = gltf['materials'][0]
base_img = gltf['textures'][mat['pbrMetallicRoughness']['baseColorTexture']['index']]['source']
orm_img = gltf['textures'][mat['pbrMetallicRoughness']['metallicRoughnessTexture']['index']]['source']
assert base_img == 0, 'the paint detector reads image 0 as the base colour map'
# repaint the roughness/metal map first: its paint detector needs the untouched base colour map
repaint(orm_img, 'PNG')
repaint(base_img, 'JPEG')

# ── 2. split the CRT glass into its own mesh ────────────────────────────────
comp_parent = next(i for i, n in enumerate(gltf['nodes']) if n.get('name') == 'comp_low')
comp_node = gltf['nodes'][comp_parent]['children'][0]
prim = gltf['meshes'][gltf['nodes'][comp_node]['mesh']]['primitives'][0]
P = read_accessor(prim['attributes']['POSITION'])
N = read_accessor(prim['attributes']['NORMAL'])
UV = read_accessor(prim['attributes']['TEXCOORD_0']).astype(np.float64)
I = read_accessor(prim['indices']).reshape(-1, 3)

# flood-fill the UV island that contains the seed point (triangles connected through shared vertices)
centroids = UV[I].mean(1)
seed = int(np.hypot(centroids[:, 0] - CRT_UV_SEED[0], centroids[:, 1] - CRT_UV_SEED[1]).argmin())
by_vertex = {}
for t, tri in enumerate(I):
    for v in tri:
        by_vertex.setdefault(int(v), []).append(t)
island, stack = {seed}, [seed]
while stack:
    for v in I[stack.pop()]:
        for t in by_vertex[int(v)]:
            if t not in island:
                island.add(t)
                stack.append(t)
island = np.array(sorted(island))
keep = np.ones(len(I), bool)
keep[island] = False
print(f'CRT island: {len(island)} triangles, atlas uv {UV[I[island]].reshape(-1, 2).min(0).round(4).tolist()} to {UV[I[island]].reshape(-1, 2).max(0).round(4).tolist()}')

used, inverse = np.unique(I[island].reshape(-1), return_inverse=True)
sP, sN = P[used], N[used]
# new UVs: flat projection as seen from the front (world +x). u runs left to right, v runs top to bottom (glTF convention)
world = (WORLD[comp_node] @ np.c_[sP.astype(np.float64), np.ones(len(sP))].T).T[:, :3]
(ymin, zmin), (ymax, zmax) = world[:, 1:].min(0), world[:, 1:].max(0)
sUV = np.c_[(zmax - world[:, 2]) / (zmax - zmin), (ymax - world[:, 1]) / (ymax - ymin)].astype(np.float32)
print(f'CRT size in file units: {zmax - zmin:.1f} wide x {ymax - ymin:.1f} tall (aspect {(zmax - zmin) / (ymax - ymin):.3f})')

# the monitor keeps every other triangle
new_idx = add_accessor(I[keep].reshape(-1).astype(np.uint32), 'SCALAR', 5125, target=34963)
prim['indices'] = new_idx

gltf['materials'].append({
    'name': 'crt_screen',
    'pbrMetallicRoughness': {'baseColorFactor': [0.012, 0.03, 0.026, 1], 'metallicFactor': 0, 'roughnessFactor': 0.12},
})
gltf['meshes'].append({'name': 'crt_screen', 'primitives': [{
    'attributes': {
        'POSITION': add_accessor(sP.astype(np.float32), 'VEC3', 5126, target=34962, minmax=True),
        'NORMAL': add_accessor(sN.astype(np.float32), 'VEC3', 5126, target=34962),
        'TEXCOORD_0': add_accessor(sUV, 'VEC2', 5126, target=34962),
    },
    'indices': add_accessor(inverse.astype(np.uint32), 'SCALAR', 5125, target=34963),
    'material': len(gltf['materials']) - 1,
    'mode': 4,
}]})
gltf['nodes'].append({'name': 'crt_screen', 'mesh': len(gltf['meshes']) - 1})
gltf['nodes'][comp_parent]['children'].append(len(gltf['nodes']) - 1)

# ── 3. give the mesh nodes real names ───────────────────────────────────────
for n in gltf['nodes']:
    kids = n.get('children', [])
    if kids and n.get('name', '').endswith('_low'):
        child = gltf['nodes'][kids[0]]
        child['name'] = n['name']
        gltf['meshes'][child['mesh']]['name'] = n['name']
        n['name'] = n['name'] + '_group'
mat['name'] = 'deck_body'
gltf['asset'].setdefault('extras', {})['modified'] = 'Lettering changed to SM-01; CRT glass split into crt_screen; nodes renamed. See CREDITS.md.'

# ── write the GLB ───────────────────────────────────────────────────────────
blob = bytearray()
for v, c in zip(views, chunks):
    pad = (-len(blob)) % 4
    blob += b'\0' * pad
    v['byteOffset'] = len(blob)
    v['byteLength'] = len(c)
    blob += c
blob += b'\0' * ((-len(blob)) % 4)
gltf['buffers'] = [{'byteLength': len(blob)}]
js = json.dumps(gltf, separators=(',', ':')).encode()
js += b' ' * ((-len(js)) % 4)
total = 12 + 8 + len(js) + 8 + len(blob)
OUT.write_bytes(struct.pack('<4sII', b'glTF', 2, total) + struct.pack('<I4s', len(js), b'JSON') + js + struct.pack('<I4s', len(blob), b'BIN\0') + bytes(blob))
print(f'wrote {OUT.name}: {total / 1e6:.1f} MB')

# Credits

## 3D models

**"Cyberdeck"** by [7chaner](https://sketchfab.com/7chaner)
- Source: <https://sketchfab.com/3d-models/cyberdeck-eb82075a071c49aca7fc0e0ec619664c>
- Licence: [Creative Commons Attribution 4.0 (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/). The author must be credited; commercial use is allowed.
- Files: `source-assets/cyberdeck.glb` (original download, 43 MB, untouched, not served), `source-assets/cyberdeck-sm01.glb` (edited copy, built by `source-assets/build_cyberdeck.py`) and `public/models/cyberdeck-web.glb` (the compressed copy the site loads, 2.4 MB)
- Changes (the site's copy is modified):
  - The painted "Netlight" lettering on the keyboard deck was replaced with "SM-01" by repainting the base-colour and roughness/metal textures.
  - The main CRT glass was split from the monitor mesh into its own mesh (`crt_screen`) with new UVs and its own material, and the site draws its own teal screen content on it.
  - Mesh nodes were renamed after their parent groups, and the material was renamed `deck_body`.
  - Textures were reduced from 4096 to 2048 px and converted to WebP, and the geometry was compressed with Meshopt (`gltf-transform optimize`, parts kept separate, no simplification).

### Credit line shown on the site

Any page that renders this model must show this line where visitors can see it, for example in the footer:

> "Cyberdeck" by 7chaner (sketchfab.com/7chaner), licensed under CC BY 4.0. Modified.

The title links to the Sketchfab source page, the name links to the author's profile, and "CC BY 4.0" links to the licence. Drop "Modified." if the model is used unchanged.

```html
<p class="credit">
  3D model: <a href="https://sketchfab.com/3d-models/cyberdeck-eb82075a071c49aca7fc0e0ec619664c">“Cyberdeck”</a>
  by <a href="https://sketchfab.com/7chaner">7chaner</a>,
  licensed under <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Modified.
</p>
```

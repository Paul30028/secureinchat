# SecureInChat mark (approved direction 2026-11-04)

One mark for the app and the website: a shield whose point turns into a speech-bubble tail
(Secure + Chat), with three typing dots inside (In chat). The last dot is morning gold.

| File | Use |
|---|---|
| `mark-color.svg` | Full-colour master on the teal square (store icon, social avatar, legacy launcher PNGs) |
| `mark-foreground.svg` / `mark-background.svg` | Android adaptive icon layers (108 × 108) |
| `mark-mono.svg` | Android 13+ themed icon layer: one opaque shape, dots cut out |
| `favicon.svg` | Website favicon and header mark (rounded tile, view box 16–92) |
| `contact-sheet.png` | The mark at 192 / 48 / 24 px, monochrome, header lock-ups and browser tabs |

Geometry: drawn on a 108 × 108 canvas, then scaled by 0.86 so the whole mark (tail included)
sits inside Android's 66 × 66 dp safe zone (x 31.6–79.6, y 24.3–83.6).

Colours: deep teal #123B3A, paper #F4EFE4, morning gold #E3A23B.
Clear space: at least a quarter of the mark's width on every side. Minimum size: 16 px.

Android resources generated from these files: `res/drawable/ic_launcher_foreground.xml`,
`res/drawable/ic_launcher_monochrome.xml`, `res/mipmap-anydpi-v26/ic_launcher*.xml`,
colour `ic_launcher_background`, and legacy PNGs `mipmap-*/ic_launcher*.png` (48–192 px).
Splash screens (`drawable-*/splash.png`) still show the old artwork and are a follow-up.

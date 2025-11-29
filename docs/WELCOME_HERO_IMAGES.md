# Welcome hero images: designer checklist

The onboarding Welcome step uses a PNG-first image system with optional high-DPI `@2x` support and SVG fallback. Designers can update visuals without code changes by dropping files into the public folder.

- Location: `public/images/welcome/`
- Themes (current keys): `winter`, `waterfall`, `bear`
- Filenames per theme (kebab-case, no spaces):
  - 1x: `<name>.png` (e.g., `winter-wonderland.png`)
  - 2x: `<name>@2x.png` (e.g., `winter-wonderland@2x.png`) — optional
  - Optional fallback: `<name>.svg` (used automatically if PNGs fail)

## Recommended specs
- Aspect ratio: 16:9
- Dimensions: 1x = 800×450, 2x = 1600×900
- Format: PNG (avoid unnecessary alpha if not needed)
- Target size: ≤ 75 KB (1x), ≤ 150 KB (2x)

## Optimization tools
- TinyPNG: https://tinypng.com/
- Squoosh: https://squoosh.app/

## How the app loads images
- Preloads the selected theme’s 1x image on Step 0 to improve LCP
- Uses `srcset` to select `@2x` on high-DPI screens when available
- Falls back to 1x PNG if `@2x` is missing
- Falls back to SVG if PNG fails to load

## Notes
- Use kebab-case filenames (no spaces) to avoid path issues across servers and Android WebView.
- Do not lazy-load the hero image; it’s above-the-fold content.
- Replacing an existing theme image requires no code change; adding a brand-new theme key requires a dev update to `WELCOME_THEMES` in `src/pages/SevenDayCostForecaster.jsx`.

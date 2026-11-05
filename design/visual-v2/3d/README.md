# 3D-rendered illustrations (draft, Paul 2026-11-05: line art has no visual impact)

`data-flows.scene.html` builds the scene with three.js 0.160.0 (used only here, at design time, to render the picture;
the website ships a static image and loads no script). Render: serve this folder next to `node_modules/three`
(`npm install three@0.160.0` in a scratch folder), open it in Playwright Chromium with SwiftShader, screenshot the canvas.
Brand colours only; orthographic isometric camera; one warm key light with soft shadows, a cool rim light.

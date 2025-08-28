// build-inline.js — bundle React + compile Tailwind v4 (via @tailwindcss/postcss), puis inline dans ui.html
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const postcss = require('postcss');
const atImport = require('postcss-import');
const tailwindPostcss = require('@tailwindcss/postcss'); // ✅ v4
const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');

const TEMPLATE = path.resolve(__dirname, 'ui.template.html');
const OUT_HTML = path.resolve(__dirname, 'ui.html');
const ENTRY = path.resolve(__dirname, 'src/ui-react/main.tsx');
const CSS_ENTRY = path.resolve(__dirname, 'src/ui-react/globals.css');

async function main() {
  if (!fs.existsSync(TEMPLATE)) {
    console.error('❌ ui.template.html introuvable (manque le marqueur <!-- INLINE_UI_CSS -->)');
    process.exit(1);
  }

  // 1) JS bundle (IIFE)
  const jsResult = await esbuild.build({
    entryPoints: [ENTRY],
    bundle: true,
    write: false,
    format: 'iife',
    target: 'es2018',
    jsx: 'automatic',
  });
  const js = jsResult.outputFiles[0].text;

  // 2) CSS: PostCSS avec Tailwind v4 plugin
  const cssSrc = fs.readFileSync(CSS_ENTRY, 'utf8');
  const cssResult = await postcss([
    atImport(),                 // gère les @import si tu en as
    tailwindPostcss(),          // ✅ Tailwind v4
    autoprefixer(),
    cssnano({ preset: 'default' }),
  ]).process(cssSrc, { from: CSS_ENTRY });
  const css = cssResult.css;

  if (!css || !css.trim()) {
    console.error('❌ CSS généré vide. Vérifie globals.css (directives @import "tailwindcss"; et @source).');
    process.exit(1);
  }

  // 3) Injection dans le template
  let html = fs.readFileSync(TEMPLATE, 'utf8');
  if (!html.includes('<!-- INLINE_UI_CSS -->') || !html.includes('<!-- INLINE_UI_JS -->')) {
    console.error('❌ Les marqueurs manquent dans ui.template.html');
    process.exit(1);
  }

  const inlined = html
    .replace('<!-- INLINE_UI_CSS -->', `<style>${css}</style>`)
    .replace('<!-- INLINE_UI_JS -->', `<script>${js}\n</script>`);

  fs.writeFileSync(OUT_HTML, inlined, 'utf8');
  console.log(`✅ ui.html généré (CSS ${css.length} bytes + JS ${js.length} bytes inlinés)`);
}

main().catch((err) => { console.error(err); process.exit(1); });

// Generates demo.html: a single self-contained file bundling index.html plus every
// js/*.js module, template/model script, and image it depends on, with no <script
// type="module"> imports and no fetch() calls left — so it opens and runs directly
// from the filesystem (file://) with no local server, unlike index.html which needs
// one (ES module imports and fetch() of templates/models are both blocked under
// file:// by the browser's same-origin rules).
//
// Regenerate after touching js/*.js, index.html, templates/*.txt, or the embedded
// models/textures/favicon listed below:
//   deno run --allow-read --allow-write tools/build-demo.js

const root = new URL('..', import.meta.url);

async function readText(path) {
    return await Deno.readTextFile(new URL(path, root));
}

async function readBase64(path) {
    const bytes = await Deno.readFile(new URL(path, root));
    return encodeBase64(bytes);
}

function encodeBase64(bytes) {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
}

// Strip `import {...} from '...';` / `import * as x from '...';` lines and the
// `export ` prefix on top-level declarations, so the module becomes plain script
// code that can be concatenated with the others into one shared top-level scope.
function stripModuleSyntax(source) {
    return source
        .split('\n')
        .filter((line) => !/^\s*import\s/.test(line))
        .map((line) => line.replace(/^(\s*)export\s+/, '$1'))
        .join('\n');
}

// js/lib/mat4.js is imported elsewhere as `import * as mat4 from './lib/mat4.js'`
// and called as mat4.create() etc. Wrap its (export-stripped) functions in an IIFE
// that returns them as a `mat4` namespace object, so every `mat4.xxx()` call site
// in Helper.js / View3d.js keeps working unmodified.
function buildMat4Namespace(source) {
    const stripped = stripModuleSyntax(source);
    const names = [...source.matchAll(/^export (?:function|const) (\w+)/gm)].map((m) => m[1]);
    return `const mat4 = (function () {\n${stripped}\nreturn {${names.join(', ')}};\n})();`;
}

async function main() {
    const index = await readText('index.html');

    const style = index.match(/<style>([\s\S]*?)<\/style>/)[1];

    // Everything between </style> and the main <script type="module"> — nav, canvases,
    // command area, buttons — reused as-is (only the two <img> tags get their src swapped
    // for data URIs below).
    let body = index.match(/<\/style>\s*<\/head>([\s\S]*?)<script type="module">/)[1];
    const afterScript = index.match(/<\/script>([\s\S]*?)<\/body>/)[1];

    const [front, back, favicon] = await Promise.all([
        readBase64('textures/front.jpg'),
        readBase64('textures/back.jpg'),
        readBase64('favicon.ico'),
    ]);
    body = body
        .replace('src="textures/front.jpg"', `src="data:image/jpeg;base64,${front}"`)
        .replace('src="textures/back.jpg"', `src="data:image/jpeg;base64,${back}"`);

    // Templates fetched over the network in index.html (templates/*.txt, and cocotte
    // falling back to models/cocotte.txt) must become inline <template> tags so
    // load(id) finds them via document.getElementById(id) and never calls fetch().
    const fetchedTemplates = [
        ['squash-fold', 'templates/squash-fold.txt'],
        ['rabbit-ear-fold', 'templates/rabbit-ear-fold.txt'],
        ['reverse-fold', 'templates/reverse-fold.txt'],
        ['square-base', 'templates/square-base.txt'],
        ['triangle-base', 'templates/triangle-base.txt'],
        ['petal-fold', 'templates/petal-fold.txt'],
        ['cocotte', 'models/cocotte.txt'],
    ];
    const inlineTemplates = (await Promise.all(
        fetchedTemplates.map(async ([id, path]) => `<template id="${id}">\n${await readText(path)}</template>`)
    )).join('\n');

    // Module source, in dependency order (each only needs classes/functions already
    // concatenated above it), export/import stripped so they share one top-level scope.
    const moduleFiles = [
        'js/Vector3.js', 'js/Point.js', 'js/Segment.js', 'js/Face.js', 'js/Plane.js',
        'js/Model.js', 'js/Interpolator.js', 'js/ReadWrite.js', 'js/Command.js',
        'js/CommandArea.js', 'js/Helper.js', 'js/View2d.js', 'js/View3d.js',
    ];
    const mat4Namespace = buildMat4Namespace(await readText('js/lib/mat4.js'));
    const modules = (await Promise.all(moduleFiles.map(async (f) => stripModuleSyntax(await readText(f)))));

    // The page's own init script, same transform (its imports are now satisfied by
    // the concatenated modules above instead of by <script type="module"> resolution).
    const mainScript = stripModuleSyntax(index.match(/<script type="module">([\s\S]*?)<\/script>/)[1]);

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <title>Origami (standalone demo)</title>
  <link rel="icon" type="image/x-icon" href="data:image/x-icon;base64,${favicon}">
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${style}</style>
</head>
${body}${inlineTemplates}
${afterScript}<script type="module">
// No real imports/exports remain below (stripped at build time), but this still
// needs to be type="module" rather than a plain script: init() at the bottom
// assumes every <template> above it (both the ones inlined here and index.html's
// own open/undo/run/test/plane/boat/etc.) is already parsed into the DOM, which
// only holds if this script's execution is deferred like index.html's original
// <script type="module"> — a plain <script> here would run immediately, before
// the parser reaches those <template> tags, and "Template not found" for all of
// them.
// ---- Bundled js/lib/mat4.js ----
${mat4Namespace}

// ---- Bundled js/*.js (dependency order; import/export stripped) ----
${modules.join('\n\n')}

// ---- index.html init script ----
${mainScript}
</script>
</body>
</html>
`;

    await Deno.writeTextFile(new URL('demo.html', root), html);
    console.log('Wrote demo.html');
}

await main();

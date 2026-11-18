/**
 * HARDENING RM-2143: the widget's --ink / --oxide come from config.branding, not from literals in styles.ts.
 * Run: node --test test/branding.test.ts   (after `npm run build`; it reads the built bundle and the generated config)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-ignore — a plain .mjs module beside build.mjs
import { resolveBranding, DEFAULT_BRANDING } from '../branding.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = join(HERE, '..', '..', 'site');

test('styles.ts carries no literal for the two brand colours', () => {
  const src = readFileSync(join(HERE, '..', 'src', 'styles.ts'), 'utf8');
  assert.match(src, /--ink:\$\{__BRANDING__\.primaryColor\};--oxide:\$\{__BRANDING__\.accentColor\}/);
  assert.equal(/--ink:#|--oxide:#/.test(src), false);
});
test('resolveBranding: a #RRGGBB pair is used; absent keys fall back WITH a warning; anything else is refused', () => {
  assert.deepEqual(resolveBranding({ branding: { primaryColor: '#112233', accentColor: '#AABBCC' } }).branding,
    { primaryColor: '#112233', accentColor: '#AABBCC' });
  const r = resolveBranding({});
  assert.deepEqual(r.branding, { ...DEFAULT_BRANDING }); assert.equal(r.warnings.length, 2);
  for (const bad of ['red', '#123', '#12345G', '#112233;}:host{display:none', 12, null])
    assert.throws(() => resolveBranding({ branding: { primaryColor: bad } }), /#RRGGBB/, String(bad));
});
test('the built bundle carries the generated config\'s colours', { skip: !existsSync(join(SITE, 'public', 'barber-widget.js')) }, () => {
  const cfg = JSON.parse(readFileSync(join(SITE, 'config.generated.json'), 'utf8'));
  const js = readFileSync(join(SITE, 'public', 'barber-widget.js'), 'utf8');
  const { branding } = resolveBranding(cfg);
  // esbuild inlines __BRANDING__ as an object and the template fills it at run time: the values are the object's.
  assert.ok(js.includes(`primaryColor:"${branding.primaryColor}"`) && js.includes(`accentColor:"${branding.accentColor}"`));
  assert.match(js, /--ink:\$\{\w+\.primaryColor\};--oxide:\$\{\w+\.accentColor\}/);
});

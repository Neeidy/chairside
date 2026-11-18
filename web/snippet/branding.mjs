/**
 * HARDENING RM-2143 — the widget's two brand colours, from config.branding. They are written into a STYLESHEET on a
 * stranger's page, so only a #RRGGBB value is accepted (anything else could close the declaration and inject CSS).
 * The schema lets `branding` be absent: then the Cream & Ink defaults are used, and the caller is told so.
 * Pure: returns { branding, warnings } or throws; build.mjs prints and fails. Tested by test/branding.test.ts.
 */
export const DEFAULT_BRANDING = Object.freeze({ primaryColor: '#16150F', accentColor: '#B4472E' });
const HEX = /^#[0-9A-Fa-f]{6}$/;
export function resolveBranding(config) {
  const branding = { ...DEFAULT_BRANDING }, warnings = [];
  for (const k of ['primaryColor', 'accentColor']) {
    const v = config?.branding?.[k];
    if (v === undefined) { warnings.push(`config.branding.${k} is not set — the widget uses the default ${DEFAULT_BRANDING[k]}.`); continue; }
    if (typeof v !== 'string' || !HEX.test(v)) throw new Error(`config.branding.${k} must be a #RRGGBB colour (it is written into the widget's stylesheet).`);
    branding[k] = v;
  }
  return { branding, warnings };
}

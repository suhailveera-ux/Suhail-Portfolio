'use strict';
/**
 * Minimal YAML-frontmatter parser — intentionally not a full YAML implementation.
 * It supports exactly the shapes used in content/blog/*.md:
 *   key: "quoted string"
 *   key: ['a', 'b'] or ["a", "b"]
 *   key: bareword   (e.g. draft / published)
 *   key: 123        (number)
 *   key: ""         (empty string)
 * Kept dependency-free on purpose: this environment has no registry access,
 * so pulling in gray-matter/js-yaml isn't an option, and a tiny parser that
 * matches our own authoring format is more reliable than a partial clone
 * of a complex spec.
 */

function parseScalar(raw) {
  const v = raw.trim();
  if (v === '') return '';
  if (v.startsWith('[') && v.endsWith(']')) {
    const inner = v.slice(1, -1).trim();
    if (inner === '') return [];
    return inner.split(',').map(s => parseScalar(s.trim()));
  }
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (v === 'true') return true;
  if (v === 'false') return false;
  return v;
}

function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, content: raw };
  const [, fmBlock, body] = m;
  const data = {};
  const lines = fmBlock.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1);
    data[key] = parseScalar(val);
  }
  return { data, content: body.replace(/^\r?\n/, '') };
}

module.exports = { parseFrontmatter };

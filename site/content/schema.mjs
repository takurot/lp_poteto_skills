const str = (max) => (max === undefined ? { t: "string" } : { t: "string", max });
const obj = (fields) => ({ t: "object", fields });
const arr = (of, { min, max } = {}) => ({ t: "array", of, min, max });

// One schema for every locale file. SPEC §3 sections 0-8 plus page metadata and the 404 page.
export const schema = obj({
  meta: obj({
    title: str(),
    description: str(160),
    og: obj({ title: str(), description: str() }),
  }),
  header: obj({ wordmark: str(), navLabel: str(), languageSwitchLabel: str(), githubLabel: str() }),
  hero: obj({ overline: str(), heading: str(), lead: str(), ctaLabel: str() }),
  numbers: obj({ heading: str(), items: arr(obj({ value: str(), label: str() }), { min: 4, max: 4 }) }),
  install: obj({
    heading: str(),
    intro: str(),
    commands: arr(str(), { min: 1 }),
    optionNotes: arr(str()),
  }),
  codex: obj({
    heading: str(),
    intro: str(),
    commands: arr(str(), { min: 1 }),
    plugins: arr(str(), { min: 1 }),
    codexHooksNote: str(),
  }),
  converts: obj({
    heading: str(),
    rows: arr(obj({ from: str(), to: str() }), { min: 1, max: 6 }),
  }),
  boundaries: obj({ heading: str(), items: arr(str(), { min: 4, max: 5 }) }),
  pullQuote: str(),
  footer: obj({ license: str(), credits: str(), copyrightHolders: str(), githubLabel: str() }),
  notFound: obj({ title: str(), message: str(), linkLabel: str() }),
});

function typeName(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isNaN(value)) return "NaN";
  return typeof value;
}

const ROOT = "(root)";
const join = (path, key) => (path === ROOT ? key : `${path}.${key}`);

const CHECKS = {
  string(value, node, path) {
    if (typeof value !== "string") return [`${path}: expected string, got ${typeName(value)}`];
    const length = [...value].length;
    return node.max !== undefined && length > node.max ? [`${path}: length ${length} exceeds max ${node.max}`] : [];
  },
  number(value, node, path) {
    return Number.isFinite(value) ? [] : [`${path}: expected number, got ${typeName(value)}`];
  },
  array(value, node, path) {
    if (!Array.isArray(value)) return [`${path}: expected array, got ${typeName(value)}`];
    const size = [];
    if (node.min !== undefined && value.length < node.min) size.push(`${path}: expected at least ${node.min} items, got ${value.length}`);
    if (node.max !== undefined && value.length > node.max) size.push(`${path}: expected at most ${node.max} items, got ${value.length}`);
    return [...size, ...value.flatMap((item, index) => check(item, node.of, `${path}[${index}]`))];
  },
  object(value, node, path) {
    if (typeName(value) !== "object") return [`${path}: expected object, got ${typeName(value)}`];
    const missing = Object.keys(node.fields)
      .filter((key) => !Object.hasOwn(value, key))
      .map((key) => `${join(path, key)}: missing key`);
    const unknown = Object.keys(value)
      .filter((key) => !Object.hasOwn(node.fields, key))
      .map((key) => `${join(path, key)}: unknown key`);
    const nested = Object.entries(node.fields)
      .filter(([key]) => Object.hasOwn(value, key))
      .flatMap(([key, child]) => check(value[key], child, join(path, key)));
    return [...missing, ...unknown, ...nested];
  },
};

function check(value, node, path) {
  return CHECKS[node.t](value, node, path);
}

// Returns path-qualified error strings; an empty array means the value conforms.
export function validate(value, node) {
  return check(value, node, ROOT);
}

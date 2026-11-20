const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

export function decode(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, name) => {
    if (name[0] === "#") {
      const hex = name[1] === "x" || name[1] === "X";
      return String.fromCodePoint(Number.parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10));
    }
    return ENTITIES[name.toLowerCase()] ?? match;
  });
}

// Returns the decoded attributes of every start tag named `name`, in document order.
export function tags(html, name) {
  const tagPattern = new RegExp(`<${name}(\\s[^>]*)?>`, "gi");
  return [...html.matchAll(tagPattern)].map(([, attrText = ""]) =>
    Object.fromEntries([...attrText.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)].map(([, key, value = ""]) => [key.toLowerCase(), decode(value)])),
  );
}

export function metaContent(html, key) {
  const matches = tags(html, "meta").filter((attrs) => attrs.name === key || attrs.property === key);
  if (matches.length !== 1) {
    throw new Error(`expected exactly one <meta> for ${key}, found ${matches.length}`);
  }
  return matches[0].content;
}

export function linksByRel(html, rel) {
  return tags(html, "link").filter((attrs) => attrs.rel === rel);
}

export function anchors(html) {
  return [...html.matchAll(/<a(\s[^>]*)?>([\s\S]*?)<\/a>/gi)].map(([, attrText = "", inner]) => ({
    href: tags(`<a${attrText}>`, "a")[0].href,
    text: decode(inner.replace(/<[^>]*>/g, "")).trim(),
  }));
}

// Inner markup of the first <name> start tag whose attributes satisfy `match`, up to the next </name>.
// Only for elements that do not nest inside themselves (section, header, nav, ul, table).
export function innerOf(html, name, match = () => true) {
  const pattern = new RegExp(`<${name}(\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "gi");
  for (const [, attrText = "", inner] of html.matchAll(pattern)) {
    if (match(tags(`<${name}${attrText}>`, name)[0])) return inner;
  }
  throw new Error(`no <${name}> matched`);
}

export const classes = (attrs) => (attrs.class ?? "").split(/\s+/).filter(Boolean);

export function textOf(html, name) {
  const matches = [...html.matchAll(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "gi"))];
  return matches.map(([, inner]) => decode(inner.replace(/<[^>]*>/g, "")).trim());
}

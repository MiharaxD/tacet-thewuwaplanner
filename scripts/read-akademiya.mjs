// Read public Next.js page data; never execute scripts from the source page.
export function pageRecords(html, key) {
  const chunks = [...html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)].map(m => JSON.parse(m[1])).join('');
  const records = [];
  for (const match of chunks.matchAll(new RegExp('\\{"' + key + '":', 'g'))) {
    let depth = 0, quoted = false, escaped = false;
    for (let i = match.index; i < chunks.length; i++) {
      const char = chunks[i];
      if (quoted) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') quoted = false; }
      else if (char === '"') quoted = true;
      else if (char === '{') depth++;
      else if (char === '}' && --depth === 0) { records.push(JSON.parse(chunks.slice(match.index, i + 1))); break; }
    }
  }
  return [...new Map(records.map(r => [r[key], r])).values()];
}

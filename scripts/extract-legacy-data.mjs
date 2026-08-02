import { readFile, writeFile, mkdir } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const outputDirectory = new URL('../app-v4/src/data/', import.meta.url);
await mkdir(outputDirectory, { recursive: true });

function extractLiteral(name, opener) {
  const declaration = `const ${name} = `;
  const declarationAt = source.indexOf(declaration);
  if (declarationAt < 0) throw new Error(`Missing ${name}`);
  const start = source.indexOf(opener, declarationAt + declaration.length);
  const closer = opener === '[' ? ']' : '}';
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'" || character === '`') { quote = character; continue; }
    if (character === opener) depth += 1;
    else if (character === closer) {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`Unterminated ${name}`);
}

async function exportJson(constantName, opener, fileName) {
  const literal = extractLiteral(constantName, opener);
  const value = vm.runInNewContext(`(${literal})`, Object.create(null), { timeout: 1000 });
  await writeFile(new URL(fileName, outputDirectory), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  console.log(`${constantName}: ${Array.isArray(value) ? value.length : Object.keys(value).length} entries`);
}

await exportJson('EXERCISE_DB', '[', 'exercises.json');
await exportJson('SUPPLEMENT_DB', '[', 'supplements.json');

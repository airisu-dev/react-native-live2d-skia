/**
 * Resolves `file` relative to the folder of `from` (both `/`-separated, relative paths).
 * Adapted from the library's `resolvePath` (`loader/modelContext.ts`), which isn't exported.
 * These are file paths, not URLs, so `?` and `#` are kept as part of the name.
 */
export function resolvePath(from: string, file: string): string {
  const parts = from.split('/').slice(0, -1)
  for (const part of file.split('/')) {
    if (part === '..') parts.pop()
    else if (part !== '.' && part !== '') parts.push(part)
  }
  return parts.join('/')
}

export function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

import type { Model3Json } from '@airisu-dev/react-native-live2d-skia'
import { Directory, File } from 'expo-file-system'
import { getUnzip } from 'react-native-nitro-unzip'
import { baseName, resolvePath } from './paths'
import { type ModelRecord, modelDir } from './storage'

export type ImportStepStatus = 'pending' | 'active' | 'done'

export type ImportStep = {
  key: 'extract' | 'find' | 'check' | 'read'
  label: string
  status: ImportStepStatus
}

export type ImportFileProgress = { done: number; total: number }

export type ImportProgressHandler = (
  steps: ImportStep[],
  progress: number,
  files: ImportFileProgress,
) => void

export type ImportOptions = {
  isCancelled?: () => boolean
}

export class ImportCancelledError extends Error {
  constructor() {
    super('Import cancelled')
    this.name = 'ImportCancelledError'
  }
}

const MODEL3_SUFFIX = '.model3.json'
const CANCEL_POLL_MS = 150

const yieldToUI = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

function isJunk(path: string): boolean {
  const segments = path.split('/')
  const name = segments[segments.length - 1] ?? ''
  return segments.includes('__MACOSX') || name === '.DS_Store' || name.startsWith('._')
}

/**
 * A `file://` URI as a filesystem path. The extractor strips `file://` but doesn't decode, so a
 * picked file named with spaces (`%20`) would not be found.
 */
function toPath(uri: string): string {
  return decodeURIComponent(uri.replace(/^file:\/\//, ''))
}

function listFiles(dir: Directory, prefix = ''): string[] {
  const paths: string[] = []
  for (const entry of dir.list()) {
    const path = prefix + entry.name
    if (entry instanceof Directory) paths.push(...listFiles(entry, `${path}/`))
    else paths.push(path)
  }
  return paths
}

function pruneOutside(dir: Directory, keep: string) {
  if (keep === '') return
  const [head, ...rest] = keep.split('/').filter(Boolean)
  for (const entry of dir.list()) {
    if (entry instanceof Directory && entry.name === head) {
      pruneOutside(entry, rest.length > 0 ? `${rest.join('/')}/` : '')
    } else {
      entry.delete()
    }
  }
}

function deleteJunk(dir: Directory) {
  for (const entry of dir.list()) {
    if (isJunk(entry.name) || entry.name === '__MACOSX') entry.delete()
    else if (entry instanceof Directory) deleteJunk(entry)
  }
}

function describeExtractError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error)
  if (
    /backslash/i.test(message) ||
    (/^Refusing to extract/.test(message) && message.includes('\\'))
  ) {
    return new Error(
      "This zip stores its file paths with backslashes (\\), which isn't allowed in a zip, so it wasn't imported. Zip the model folder again with your system's Compress / Send to › Compressed folder, or 7-Zip.",
    )
  }
  if (/^Refusing to extract/.test(message)) {
    return new Error(`This zip contains an unsafe file, so it wasn't imported. (${message})`)
  }
  if (/Could not (open|read) ZIP|error in opening zip/i.test(message)) {
    return new Error("This file isn't a zip, or it's damaged.")
  }
  return error instanceof Error ? error : new Error(message)
}

export async function importModelZip(
  file: { uri: string; name: string; size?: number },
  onProgress: ImportProgressHandler,
  options: ImportOptions = {},
): Promise<ModelRecord> {
  const steps: ImportStep[] = [
    { key: 'extract', label: 'Extracting the zip', status: 'active' },
    { key: 'find', label: 'Finding .model3.json', status: 'pending' },
    { key: 'check', label: 'Checking moc3 and textures', status: 'pending' },
    { key: 'read', label: 'Reading motions and expressions', status: 'pending' },
  ]
  let files: ImportFileProgress = { done: 0, total: 0 }
  let progress = 0
  const report = () =>
    onProgress(
      steps.map((s) => ({ ...s })),
      progress,
      files,
    )
  const setStep = (key: ImportStep['key'], status: ImportStepStatus, label?: string) => {
    const step = steps.find((s) => s.key === key)!
    step.status = status
    if (label) step.label = label
  }
  const checkCancelled = () => {
    if (options.isCancelled?.()) throw new ImportCancelledError()
  }

  report()
  await yieldToUI()

  const id = newId()
  const dir = modelDir(id)
  try {
    checkCancelled()
    dir.create({ intermediates: true, idempotent: true })

    const task = getUnzip().extract(toPath(file.uri), toPath(dir.uri))
    task.onProgress((p) => {
      files = { done: p.extractedFiles, total: p.totalFiles }
      progress = 0.85 * p.progress
      report()
    })
    const poll = setInterval(() => {
      if (options.isCancelled?.()) task.cancel()
    }, CANCEL_POLL_MS)
    try {
      await task.await()
    } catch (error) {
      checkCancelled()
      throw describeExtractError(error)
    } finally {
      clearInterval(poll)
    }
    checkCancelled()
    setStep('extract', 'done', `Extracted ${files.total} file${files.total === 1 ? '' : 's'}`)
    setStep('find', 'active')
    progress = 0.85
    report()
    await yieldToUI()

    const paths = listFiles(dir).filter((p) => !isJunk(p))
    const model3Paths = paths.filter((p) => p.toLowerCase().endsWith(MODEL3_SUFFIX))
    if (model3Paths.length === 0) {
      throw new Error(
        'No .model3.json found in this zip. Pick a zip that contains an exported Cubism 3+ model folder.',
      )
    }
    if (model3Paths.length > 1) {
      throw new Error(
        `This zip contains ${model3Paths.length} models (${model3Paths.join(', ')}). Pick a zip with one .model3.json.`,
      )
    }
    const model3Path = model3Paths[0]!
    const model3FileName = baseName(model3Path)
    const prefix = model3Path.slice(0, model3Path.length - model3FileName.length)
    setStep('find', 'done', `Found ${model3FileName}`)
    setStep('check', 'active')
    progress = 0.9
    report()
    await yieldToUI()

    const fileAt = (path: string) => new File(dir, ...path.split('/'))
    let settings: Model3Json
    try {
      settings = JSON.parse(await fileAt(model3Path).text()) as Model3Json
    } catch {
      throw new Error(`${model3FileName} isn't valid JSON.`)
    }
    const refs = settings.FileReferences ?? {}
    if (!refs.Moc) throw new Error(`${model3FileName} doesn't reference a .moc3 file.`)
    const present = new Set(paths)
    const requireFile = (ref: string, kind: string) => {
      const path = resolvePath(model3Path, ref)
      if (!path.startsWith(prefix) || !present.has(path)) {
        throw new Error(`The ${kind} "${ref}" listed in ${model3FileName} isn't in the zip.`)
      }
    }
    requireFile(refs.Moc, 'moc3 file')
    const textures = refs.Textures ?? []
    for (const texture of textures) requireFile(texture, 'texture')
    // Only the model's folder is kept: other files in the zip and junk go.
    pruneOutside(dir, prefix)
    deleteJunk(dir)
    checkCancelled()
    setStep(
      'check',
      'done',
      `Checked moc3 and ${textures.length} texture${textures.length === 1 ? '' : 's'}`,
    )

    setStep('read', 'active')
    report()
    const motionCount = Object.values(refs.Motions ?? {}).reduce(
      (sum, group) => sum + group.length,
      0,
    )
    const expressionCount = refs.Expressions?.length ?? 0
    const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
    setStep(
      'read',
      'done',
      `Read ${plural(motionCount, 'motion')} and ${plural(expressionCount, 'expression')}`,
    )
    progress = 1
    report()

    const name = model3FileName.slice(0, -MODEL3_SUFFIX.length) || file.name.replace(/\.zip$/i, '')
    return {
      id,
      name,
      zipName: file.name,
      sizeBytes: file.size ?? new File(file.uri).size ?? 0,
      importedAt: new Date().toISOString(),
      model3Path,
      motionCount,
      expressionCount,
    }
  } catch (error) {
    try {
      if (dir.exists) dir.delete()
    } catch (cleanupError) {
      console.warn('[import] failed to delete partial model folder', cleanupError)
    }
    throw error
  }
}

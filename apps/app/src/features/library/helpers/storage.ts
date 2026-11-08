import { Directory, File, Paths } from 'expo-file-system'

export type ModelRecord = {
  id: string
  name: string
  zipName: string
  sizeBytes: number
  importedAt: string
  model3Path: string
  motionCount: number
  expressionCount: number
}

export type ViewerBackground = 'dots' | 'dark' | 'light'

export type ViewerSettings = {
  resetViewOnSwitch: boolean
  background: ViewerBackground
}

export type LibraryData = {
  version: 1
  activeId: string | null
  models: ModelRecord[]
  settings: ViewerSettings
}

export const defaultSettings: ViewerSettings = {
  resetViewOnSwitch: true,
  background: 'dots',
}

export const defaultLibrary: LibraryData = {
  version: 1,
  activeId: null,
  models: [],
  settings: defaultSettings,
}

const LIBRARY_FILE = 'library.json'
const MODELS_DIR = 'models'

export function modelsRootDir(): Directory {
  return new Directory(Paths.document, MODELS_DIR)
}

export function modelDir(id: string): Directory {
  return new Directory(Paths.document, MODELS_DIR, id)
}

function libraryFile(): File {
  return new File(Paths.document, LIBRARY_FILE)
}

const BACKGROUNDS: readonly ViewerBackground[] = ['dots', 'dark', 'light']

/**
 * Picks the known settings out of a stored object, falling back to the defaults. Unknown keys,
 * such as ones from older versions (e.g. `showGestureHint`), are dropped.
 */
function readSettings(value: unknown): ViewerSettings {
  if (typeof value !== 'object' || value === null) return defaultSettings
  const v = value as Record<string, unknown>
  return {
    resetViewOnSwitch:
      typeof v.resetViewOnSwitch === 'boolean'
        ? v.resetViewOnSwitch
        : defaultSettings.resetViewOnSwitch,
    background: BACKGROUNDS.includes(v.background as ViewerBackground)
      ? (v.background as ViewerBackground)
      : defaultSettings.background,
  }
}

function isRecord(value: unknown): value is ModelRecord {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.id === 'string' && typeof v.name === 'string' && typeof v.model3Path === 'string'
}

export async function loadLibrary(): Promise<LibraryData> {
  try {
    const file = libraryFile()
    if (!file.exists) return defaultLibrary
    const parsed: unknown = JSON.parse(await file.text())
    if (typeof parsed !== 'object' || parsed === null) return defaultLibrary
    const raw = parsed as Partial<LibraryData>
    const models = Array.isArray(raw.models) ? raw.models.filter(isRecord) : []
    const activeId =
      typeof raw.activeId === 'string' && models.some((m) => m.id === raw.activeId)
        ? raw.activeId
        : (models[0]?.id ?? null)
    return {
      version: 1,
      activeId,
      models,
      settings: readSettings(raw.settings),
    }
  } catch (error) {
    console.warn('[library] failed to read library.json, using defaults', error)
    return defaultLibrary
  }
}

export function saveLibrary(data: LibraryData): void {
  const file = libraryFile()
  if (!file.exists) file.create({ intermediates: true })
  file.write(JSON.stringify(data))
}

export function deleteModelFiles(id: string): void {
  const dir = modelDir(id)
  if (dir.exists) dir.delete()
}

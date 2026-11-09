import type {
  CubismJson,
  Live2DModelSource,
  Model3Json,
} from '@airisu-dev/react-native-live2d-skia'
import { File } from 'expo-file-system'
import { resolvePath } from './paths'
import { type ModelRecord, modelDir } from './storage'

export async function buildModelSource(record: ModelRecord): Promise<Live2DModelSource> {
  const dir = modelDir(record.id)
  const fileAt = (relative: string) => new File(dir, ...relative.split('/'))
  const resolve = (ref: string) => fileAt(resolvePath(record.model3Path, ref))

  const model3 = fileAt(record.model3Path)
  if (!model3.exists) {
    throw new Error(`${record.model3Path} is missing from this model's folder. Import it again.`)
  }
  const settings = JSON.parse(await model3.text()) as Model3Json
  const refs = settings.FileReferences ?? {}

  const required = (ref: string | undefined, kind: string): string => {
    if (!ref) throw new Error(`${record.model3Path} doesn't reference a ${kind}.`)
    const file = resolve(ref)
    if (!file.exists) throw new Error(`The ${kind} "${ref}" is missing. Import the model again.`)
    return file.uri
  }

  const optionalJson = async (ref: string | undefined): Promise<CubismJson | undefined> => {
    if (!ref) return undefined
    const file = resolve(ref)
    try {
      if (!file.exists) {
        console.warn(`[model] ${record.name}: ${ref} is missing, skipping it`)
        return undefined
      }
      return JSON.parse(await file.text()) as CubismJson
    } catch (error) {
      console.warn(`[model] ${record.name}: couldn't read ${ref}, skipping it`, error)
      return undefined
    }
  }

  const moc = required(refs.Moc, 'moc3 file')
  const textures = (refs.Textures ?? []).map((t) => required(t, 'texture'))

  const [physics, pose, displayInfo, motionGroups, expressionList] = await Promise.all([
    optionalJson(refs.Physics),
    optionalJson(refs.Pose),
    optionalJson(refs.DisplayInfo),
    Promise.all(
      Object.entries(refs.Motions ?? {}).map(async ([group, entries]) => {
        const loaded = await Promise.all(
          entries.map(async (entry) => ({ entry, json: await optionalJson(entry.File) })),
        )
        return [group, loaded.filter((m) => m.json !== undefined)] as const
      }),
    ),
    Promise.all(
      (refs.Expressions ?? []).map(async (e) => ({ entry: e, json: await optionalJson(e.File) })),
    ),
  ])

  // The library pairs `motions[group][i]` with `FileReferences.Motions[group][i]` (fade times),
  // so skipped motions are dropped from the settings too, keeping the indices aligned.
  const motions: Record<string, CubismJson[]> = {}
  const listedMotions: NonNullable<NonNullable<Model3Json['FileReferences']>['Motions']> = {}
  for (const [group, loaded] of motionGroups) {
    if (loaded.length === 0) continue
    motions[group] = loaded.map((m) => m.json!)
    listedMotions[group] = loaded.map((m) => m.entry)
  }
  const expressions: Record<string, CubismJson> = {}
  const listedExpressions = expressionList.filter((e) => e.json !== undefined)
  for (const { entry, json } of listedExpressions) expressions[entry.Name] = json!

  const cleanSettings: Model3Json = {
    ...settings,
    FileReferences: {
      ...refs,
      Motions: listedMotions,
      Expressions: listedExpressions.map((e) => e.entry),
    },
  }

  return {
    settings: cleanSettings,
    moc,
    textures,
    physics,
    pose,
    motions,
    expressions,
    displayInfo,
  }
}

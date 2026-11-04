import type { Live2DModelSource } from './loadModel'
import type {
  Cdi3Json,
  Exp3Json,
  ExpressionInfo,
  Model3Json,
  Motion3Json,
  MotionInfo,
  ParameterInfo,
} from './modelTypes'

/** Motions by group, in the order they can be played by index. */
export function motionsOf(source: Live2DModelSource): Record<string, MotionInfo[]> {
  const listed = (source.settings as Model3Json).FileReferences?.Motions ?? {}
  return Object.fromEntries(
    Object.entries(source.motions ?? {}).map(([group, files]) => [
      group,
      files.map((json, index): MotionInfo => {
        const entry = listed[group]?.[index]
        const meta = (json as Motion3Json).Meta
        return {
          group,
          index,
          file: entry?.File,
          duration: meta?.Duration,
          loop: meta?.Loop,
          fadeIn: entry?.FadeInTime ?? meta?.FadeInTime,
          fadeOut: entry?.FadeOutTime ?? meta?.FadeOutTime,
        }
      }),
    ]),
  )
}

export function expressionsOf(source: Live2DModelSource): ExpressionInfo[] {
  const listed = (source.settings as Model3Json).FileReferences?.Expressions ?? []
  return Object.entries(source.expressions ?? {}).map(([name, json]) => ({
    name,
    file: listed.find((e) => e.Name === name)?.File,
    parameters: ((json as Exp3Json).Parameters ?? []).map((p) => ({
      id: p.Id,
      value: p.Value,
      blend: p.Blend ?? 'Add',
    })),
  }))
}

/** Joins the moc's parameters (from native) with the `cdi3.json`'s names and groups. */
export function parametersOf(
  source: Live2DModelSource,
  native: { id: string; min: number; max: number; defaultValue: number }[],
): ParameterInfo[] {
  const display = source.displayInfo as Cdi3Json | undefined
  const names = new Map((display?.Parameters ?? []).map((p) => [p.Id, p]))
  const groups = new Map((display?.ParameterGroups ?? []).map((g) => [g.Id, g.Name]))
  return native.map(({ id, min, max, defaultValue }) => {
    const info = names.get(id)
    return {
      id,
      name: info?.Name,
      groupId: info?.GroupId || undefined,
      groupName: info?.GroupId ? groups.get(info.GroupId) : undefined,
      min,
      max,
      defaultValue,
    }
  })
}

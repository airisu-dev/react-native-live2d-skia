// The shapes of the Cubism JSON files the loader reads. Fields are optional where
// the files can leave them out; only what the library or an app might use is typed.

export interface Model3Json {
  Version?: number
  FileReferences?: {
    Moc?: string
    Textures?: string[]
    Physics?: string
    Pose?: string
    /** The `cdi3.json`: display names of parameters and parts. */
    DisplayInfo?: string
    Motions?: Record<string, Model3Motion[]>
    Expressions?: { Name: string; File: string }[]
  }
  Groups?: { Target: string; Name: string; Ids: string[] }[]
  HitAreas?: { Id: string; Name: string }[]
}

export interface Model3Motion {
  File: string
  FadeInTime?: number
  FadeOutTime?: number
}

export type ExpressionBlend = 'Add' | 'Multiply' | 'Overwrite'

export interface Exp3Json {
  Type?: string
  FadeInTime?: number
  FadeOutTime?: number
  Parameters?: { Id: string; Value: number; Blend?: ExpressionBlend }[]
}

export interface Motion3Json {
  Version?: number
  Meta?: {
    Duration?: number
    Fps?: number
    Loop?: boolean
    FadeInTime?: number
    FadeOutTime?: number
    CurveCount?: number
  }
  Curves?: { Target: 'Model' | 'Parameter' | 'PartOpacity'; Id: string }[]
}

export interface Cdi3Json {
  Version?: number
  Parameters?: { Id: string; GroupId?: string; Name?: string }[]
  ParameterGroups?: { Id: string; GroupId?: string; Name?: string }[]
  Parts?: { Id: string; Name?: string }[]
}

/** A motion listed in the `model3.json`, with what its `motion3.json` says about it. */
export interface MotionInfo {
  group: string
  /** Index in the group: what `model.motion(group, index)` takes. */
  index: number
  file?: string
  /** Seconds. */
  duration?: number
  loop?: boolean
  /** Seconds. */
  fadeIn?: number
  /** Seconds. */
  fadeOut?: number
}

/** An expression listed in the `model3.json`, with the parameters its `exp3.json` sets. */
export interface ExpressionInfo {
  /** What `model.expression(name)` takes. */
  name: string
  file?: string
  parameters: { id: string; value: number; blend: ExpressionBlend }[]
}

/** A parameter of the moc, with the display data of the `cdi3.json` when the model has one. */
export interface ParameterInfo {
  /** What `model.setParameter(id, value)` takes, e.g. `ParamAngleX`. */
  id: string
  /** Display name from the `cdi3.json`. */
  name?: string
  groupId?: string
  groupName?: string
  min: number
  max: number
  defaultValue: number
}

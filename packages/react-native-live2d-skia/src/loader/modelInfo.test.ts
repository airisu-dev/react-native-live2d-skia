import { describe, expect, test } from 'bun:test'
import type { Live2DModelSource } from './loadModel'
import { expressionsOf, motionsOf, parametersOf } from './modelInfo'

const source: Live2DModelSource = {
  settings: {
    FileReferences: {
      Motions: {
        Idle: [{ File: 'idle.motion3.json', FadeInTime: 0.5 }],
        Tap: [{ File: 'tap.motion3.json' }],
      },
      Expressions: [{ Name: 'smile', File: 'smile.exp3.json' }],
    },
  },
  moc: 1,
  textures: [],
  motions: {
    Idle: [{ Meta: { Duration: 4.5, Loop: true, FadeInTime: 1, FadeOutTime: 2 } }],
    Tap: [{ Meta: { Duration: 2 } }],
  },
  expressions: {
    smile: {
      Parameters: [
        { Id: 'ParamMouthForm', Value: 1, Blend: 'Overwrite' },
        { Id: 'X', Value: 2 },
      ],
    },
  },
  displayInfo: {
    Parameters: [
      { Id: 'ParamAngleX', GroupId: 'ParamGroupFace', Name: 'Angle X' },
      { Id: 'ParamLoose', GroupId: '', Name: 'Loose' },
    ],
    ParameterGroups: [{ Id: 'ParamGroupFace', Name: 'Face' }],
  },
}

describe('motionsOf', () => {
  test('lists motions by group with file, duration, loop and fades', () => {
    expect(motionsOf(source)).toEqual({
      Idle: [
        {
          group: 'Idle',
          index: 0,
          file: 'idle.motion3.json',
          duration: 4.5,
          loop: true,
          fadeIn: 0.5, // model3.json wins over the motion3.json's Meta
          fadeOut: 2,
        },
      ],
      Tap: [{ group: 'Tap', index: 0, file: 'tap.motion3.json', duration: 2 }],
    })
  })

  test('is empty without motions', () => {
    expect(motionsOf({ settings: {}, moc: 1, textures: [] })).toEqual({})
  })
})

describe('expressionsOf', () => {
  test('lists expressions with their parameters, blending by Add by default', () => {
    expect(expressionsOf(source)).toEqual([
      {
        name: 'smile',
        file: 'smile.exp3.json',
        parameters: [
          { id: 'ParamMouthForm', value: 1, blend: 'Overwrite' },
          { id: 'X', value: 2, blend: 'Add' },
        ],
      },
    ])
  })

  test('is empty without expressions', () => {
    expect(expressionsOf({ settings: {}, moc: 1, textures: [] })).toEqual([])
  })
})

describe('parametersOf', () => {
  const native = [
    { id: 'ParamAngleX', min: -30, max: 30, defaultValue: 0 },
    { id: 'ParamLoose', min: 0, max: 1, defaultValue: 0.5 },
    { id: 'ParamNoName', min: 0, max: 1, defaultValue: 0 },
  ]

  test('adds names and groups from the cdi3.json', () => {
    expect(parametersOf(source, native)).toEqual([
      {
        id: 'ParamAngleX',
        name: 'Angle X',
        groupId: 'ParamGroupFace',
        groupName: 'Face',
        min: -30,
        max: 30,
        defaultValue: 0,
      },
      { id: 'ParamLoose', name: 'Loose', min: 0, max: 1, defaultValue: 0.5 },
      { id: 'ParamNoName', min: 0, max: 1, defaultValue: 0 },
    ])
  })

  test('works without a cdi3.json', () => {
    const [first] = parametersOf({ settings: {}, moc: 1, textures: [] }, native)
    expect(first).toEqual({ id: 'ParamAngleX', min: -30, max: 30, defaultValue: 0 })
  })
})

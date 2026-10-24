import { describe, expect, test } from 'bun:test'
import {
  isModelContext,
  type Live2DModelContext,
  resolvePath,
  sourceFromContext,
} from './modelContext'

// A stand-in for a Metro `require.context`: a function with keys().
function fakeContext(files: Record<string, unknown>): Live2DModelContext {
  const context = (id: string) => {
    if (!(id in files)) throw new Error(`unknown module ${id}`)
    return files[id]
  }
  context.keys = () => Object.keys(files)
  return context
}

describe('resolvePath', () => {
  test('resolves next to a context key', () => {
    expect(resolvePath('./Mao/Mao.model3.json', 'Mao.moc3')).toBe('./Mao/Mao.moc3')
    expect(resolvePath('./Mao/Mao.model3.json', 'Mao.2048/texture_00.png')).toBe(
      './Mao/Mao.2048/texture_00.png',
    )
  })

  test('resolves next to a URL', () => {
    expect(resolvePath('https://cdn.test/models/Mao.model3.json', 'Mao.moc3')).toBe(
      'https://cdn.test/models/Mao.moc3',
    )
  })

  test('ignores the query and hash of the base', () => {
    expect(resolvePath('https://cdn.test/a/m.json?token=x#frag', 'b.png')).toBe(
      'https://cdn.test/a/b.png',
    )
  })

  test('goes up with `..` and skips `.` and empty segments', () => {
    expect(resolvePath('https://cdn.test/a/b/m.json', '../x.png')).toBe('https://cdn.test/a/x.png')
    expect(resolvePath('./m.json', './a//b.json')).toBe('./a/b.json')
  })
})

describe('isModelContext', () => {
  test('is true for a function and false for a source object', () => {
    expect(isModelContext(fakeContext({}))).toBe(true)
    expect(isModelContext({ settings: {}, moc: 1, textures: [] })).toBe(false)
  })
})

describe('sourceFromContext', () => {
  const model3 = {
    FileReferences: {
      Moc: 'Mao.moc3',
      Textures: ['Mao.2048/texture_00.png'],
      Physics: 'Mao.physics3.json',
      Pose: 'Mao.pose3.json',
      Motions: { Idle: [{ File: 'motions/idle.motion3.json' }] },
      Expressions: [{ Name: 'smile', File: 'exp/smile.exp3.json' }],
    },
  }
  const files = {
    './Mao/Mao.model3.json': model3,
    './Mao/Mao.moc3': 101,
    './Mao/Mao.2048/texture_00.png': 102,
    './Mao/Mao.physics3.json': { physics: true },
    './Mao/Mao.pose3.json': { pose: true },
    './Mao/motions/idle.motion3.json': { motion: 'idle' },
    './Mao/exp/smile.exp3.json': { expression: 'smile' },
  }

  test('loads every file the model3.json lists', () => {
    expect(sourceFromContext(fakeContext(files))).toEqual({
      settings: model3,
      moc: 101,
      textures: [102],
      physics: { physics: true },
      pose: { pose: true },
      motions: { Idle: [{ motion: 'idle' }] },
      expressions: { smile: { expression: 'smile' } },
    })
  })

  test('leaves out optional files the model3.json does not list', () => {
    const source = sourceFromContext(
      fakeContext({
        './m.model3.json': { FileReferences: { Moc: 'm.moc3' } },
        './m.moc3': 1,
      }),
    )
    expect(source.physics).toBeUndefined()
    expect(source.pose).toBeUndefined()
    expect(source.textures).toEqual([])
    expect(source.motions).toEqual({})
    expect(source.expressions).toEqual({})
  })

  test('fails without a model3.json', () => {
    expect(() => sourceFromContext(fakeContext({ './a.moc3': 1 }))).toThrow(/found none/)
  })

  test('fails with more than one model3.json', () => {
    expect(() =>
      sourceFromContext(fakeContext({ './a.model3.json': {}, './b.model3.json': {} })),
    ).toThrow(/a\.model3\.json, \.\/b\.model3\.json/)
  })

  test('fails when a listed file is missing from the context', () => {
    const { './Mao/Mao.moc3': _moc, ...withoutMoc } = files
    expect(() => sourceFromContext(fakeContext(withoutMoc))).toThrow(
      /Mao\.moc3 .*isn't in the require\.context/,
    )
  })

  test('fails when the model3.json has no Moc', () => {
    expect(() => sourceFromContext(fakeContext({ './m.model3.json': {} }))).toThrow(
      /no FileReferences\.Moc/,
    )
  })
})

import { beforeEach, describe, expect, mock, test } from 'bun:test'

type Call = { url: string; headers: Record<string, string> | undefined }

let calls: Call[] = []
// What the fake server answers, by URL. A missing URL is a 404.
let server: Record<string, unknown> = {}
let networkError: Error | null = null

mock.module('expo/fetch', () => ({
  fetch: async (url: string, init?: { headers?: Record<string, string> }) => {
    calls.push({ url, headers: init?.headers })
    if (networkError) throw networkError
    const body = server[url]
    return {
      ok: body !== undefined,
      status: body === undefined ? 404 : 200,
      json: async () => body,
      arrayBuffer: async () => new ArrayBuffer(8),
    }
  },
}))

const { fetchBytes, isRemote, redactUrl, sourceFromUrl } = await import('./modelUrl')

beforeEach(() => {
  calls = []
  server = {}
  networkError = null
})

describe('isRemote', () => {
  test('is true for http and https URLs only', () => {
    expect(isRemote('https://cdn.test/m.model3.json')).toBe(true)
    expect(isRemote('HTTP://cdn.test/m.model3.json')).toBe(true)
    expect(isRemote('file:///m.model3.json')).toBe(false)
    expect(isRemote('./m.model3.json')).toBe(false)
    expect(isRemote(12)).toBe(false)
  })
})

describe('redactUrl', () => {
  test('drops the query and hash, which can hold tokens', () => {
    expect(redactUrl('https://cdn.test/m.json?token=secret#frag')).toBe('https://cdn.test/m.json')
    expect(redactUrl('https://cdn.test/m.json')).toBe('https://cdn.test/m.json')
  })
})

describe('sourceFromUrl', () => {
  const base = 'https://cdn.test/models/Mao/Mao.model3.json'
  const model3 = {
    FileReferences: {
      Moc: 'Mao.moc3',
      Textures: ['Mao.2048/texture_00.png'],
      Physics: 'Mao.physics3.json',
      Motions: { Idle: [{ File: 'motions/idle 1.motion3.json' }] },
      Expressions: [{ Name: 'smile', File: 'exp/smile.exp3.json' }],
    },
  }
  const listed = (query = '') => ({
    [`${base}${query}`]: model3,
    [`https://cdn.test/models/Mao/Mao.physics3.json${query}`]: { physics: true },
    [`https://cdn.test/models/Mao/motions/idle%201.motion3.json${query}`]: { motion: 'idle' },
    [`https://cdn.test/models/Mao/exp/smile.exp3.json${query}`]: { expression: 'smile' },
  })

  test('fetches the JSON files and keeps the moc and textures as URLs', async () => {
    server = listed()
    expect(await sourceFromUrl(base)).toEqual({
      settings: model3,
      moc: 'https://cdn.test/models/Mao/Mao.moc3',
      textures: ['https://cdn.test/models/Mao/Mao.2048/texture_00.png'],
      physics: { physics: true },
      pose: undefined,
      motions: { Idle: [{ motion: 'idle' }] },
      expressions: { smile: { expression: 'smile' } },
    })
  })

  test('escapes file names with spaces, but not names that are already escaped', async () => {
    server = {
      [base]: { FileReferences: { Moc: 'a b.moc3', Textures: ['c%20d.png'] } },
    }
    const source = await sourceFromUrl(base)
    expect(source.moc).toBe('https://cdn.test/models/Mao/a%20b.moc3')
    expect(source.textures).toEqual(['https://cdn.test/models/Mao/c%20d.png'])
  })

  test("reuses the model3.json's query for files on the same host", async () => {
    server = listed('?token=abc')
    const source = await sourceFromUrl(`${base}?token=abc`)
    expect(source.moc).toBe('https://cdn.test/models/Mao/Mao.moc3?token=abc')
    expect(source.physics).toEqual({ physics: true })
  })

  test('does not send the query to another host', async () => {
    server = {
      [`${base}?token=abc`]: {
        FileReferences: { Moc: 'https://other.test/Mao.moc3', Textures: ['Mao.png'] },
      },
    }
    const source = await sourceFromUrl(`${base}?token=abc`)
    expect(source.moc).toBe('https://other.test/Mao.moc3')
    expect(source.textures).toEqual(['https://cdn.test/models/Mao/Mao.png?token=abc'])
  })

  test('resolveUrl replaces the default and gets the plain URL and the listed path', async () => {
    server = {
      [`${base}?token=abc`]: model3,
      'signed://Mao.physics3.json': { physics: true },
      'signed://motions/idle 1.motion3.json': { motion: 'idle' },
      'signed://exp/smile.exp3.json': { expression: 'smile' },
    }
    const seen: [string, string][] = []
    const source = await sourceFromUrl(`${base}?token=abc`, {
      resolveUrl: (url, file) => {
        seen.push([url, file])
        return `signed://${file}`
      },
    })
    expect(source.moc).toBe('signed://Mao.moc3')
    expect(seen).toContainEqual(['https://cdn.test/models/Mao/Mao.moc3', 'Mao.moc3'])
    expect(seen).toContainEqual([
      'https://cdn.test/models/Mao/motions/idle%201.motion3.json',
      'motions/idle 1.motion3.json',
    ])
  })

  test('sends the headers with every request', async () => {
    server = listed()
    await sourceFromUrl(base, { headers: { Authorization: 'Bearer t' } })
    expect(calls.length).toBe(4)
    for (const call of calls) expect(call.headers).toEqual({ Authorization: 'Bearer t' })
  })

  test('fails without a Moc, naming the URL without its query', async () => {
    server = { [`${base}?token=secret`]: { FileReferences: {} } }
    const error = await sourceFromUrl(`${base}?token=secret`).catch((e: Error) => e)
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain('no FileReferences.Moc')
    expect((error as Error).message).not.toContain('secret')
  })

  test('reports an HTTP error with its status and no query', async () => {
    const error = await sourceFromUrl(`${base}?token=secret`).catch((e: Error) => e)
    expect((error as Error).message).toBe(`Live2D: failed to fetch ${base} (404)`)
  })

  test('reports a network error with its reason', async () => {
    networkError = new Error('offline')
    const error = await sourceFromUrl(base).catch((e: Error) => e)
    expect((error as Error).message).toBe(`Live2D: failed to fetch ${base} (offline)`)
  })
})

describe('fetchBytes', () => {
  test('returns the response body', async () => {
    server = { 'https://cdn.test/Mao.moc3': {} }
    const bytes = await fetchBytes('https://cdn.test/Mao.moc3', {})
    expect(bytes.byteLength).toBe(8)
  })
})

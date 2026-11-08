import type { Live2DModel, ParameterInfo } from '@airisu-dev/react-native-live2d-skia'
import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { ACCENT } from './Chip'
import { Slider } from './Slider'

/** The model's current value of every parameter, by id, refreshed while mounted. */
function useLiveValues(model: Live2DModel, intervalMs = 100) {
  const [values, setValues] = useState<Record<string, number>>({})
  useEffect(() => {
    const read = () =>
      setValues(Object.fromEntries(model.native.getParameters().map((p) => [p.id, p.value])))
    read()
    const timer = setInterval(read, intervalMs)
    return () => clearInterval(timer)
  }, [model, intervalMs])
  return values
}

function ParameterRow({
  parameter,
  value,
  held,
  onChange,
  onReset,
}: {
  parameter: ParameterInfo
  value: number
  held: boolean
  onChange: (value: number) => void
  onReset: () => void
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.name} numberOfLines={1}>
          {parameter.name ?? parameter.id}
        </Text>
        <Text style={styles.value}>{value.toFixed(2)}</Text>
        <Pressable onPress={onReset} disabled={!held} hitSlop={8}>
          <Text style={[styles.reset, !held && styles.resetOff]}>Reset</Text>
        </Pressable>
      </View>
      <Slider value={value} min={parameter.min} max={parameter.max} onChange={onChange} />
    </View>
  )
}

export function ParameterSliders({ model }: { model: Live2DModel }) {
  const live = useLiveValues(model)
  // The values being held by a slider: they stay put until reset.
  const [held, setHeld] = useState<Record<string, number>>({})
  const [query, setQuery] = useState('')

  const parameters = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q
      ? model.parameters.filter((p) => `${p.name ?? ''} ${p.id}`.toLowerCase().includes(q))
      : model.parameters
  }, [model, query])

  const set = (id: string, value: number) => {
    model.setParameter(id, value)
    setHeld((h) => ({ ...h, [id]: value }))
  }
  const reset = (id: string) => {
    model.resetParameter(id)
    setHeld(({ [id]: _released, ...rest }) => rest)
  }
  const resetAll = () => {
    model.resetParameters()
    setHeld({})
  }

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={`Filter ${model.parameters.length} parameters`}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.search}
        />
        <Pressable onPress={resetAll} hitSlop={8}>
          <Text style={styles.reset}>Reset all</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        {parameters.map((p) => (
          <ParameterRow
            key={p.id}
            parameter={p}
            value={held[p.id] ?? live[p.id] ?? p.defaultValue}
            held={p.id in held}
            onChange={(v) => set(p.id, v)}
            onReset={() => reset(p.id)}
          />
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingBottom: 4 },
  search: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#eef1f5',
    fontSize: 14,
  },
  list: { padding: 12, gap: 8 },
  row: { gap: 2 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 13, fontWeight: '600', color: '#4a5563' },
  value: { fontSize: 12, fontFamily: 'monospace', color: '#4a5563' },
  reset: { fontSize: 13, fontWeight: '600', color: ACCENT },
  resetOff: { color: '#b8c0cc' },
})

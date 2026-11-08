import { type Live2DModel, useLive2DParameters } from '@airisu-dev/react-native-live2d-skia'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFrameCallback, useSharedValue } from 'react-native-reanimated'
import {
  createSynchronizable,
  createWorkletRuntime,
  scheduleOnRuntime,
} from 'react-native-worklets'
import { Chip } from './Chip'
import { Slider } from './Slider'
import { useJsFrameRate } from './useJsFrameRate'

type Source = 'ui' | 'worklet' | 'js'

const SOURCES: { source: Source; label: string; detail: string }[] = [
  { source: 'ui', label: 'UI thread', detail: 'useLive2DParameters' },
  { source: 'worklet', label: 'Worklet runtime', detail: '30 Hz, like a camera' },
  { source: 'js', label: 'JS thread', detail: '30 Hz, setInterval' },
]

const TICK_MS = 33
const MAX_SMOOTHING = 0.3

// A made-up face: what a tracker would give, as parameter values at time `t` (seconds).
function pose(t: number) {
  'worklet'
  const blink = 1 - Math.max(0, Math.sin(t * 1.7)) ** 24
  return {
    ParamAngleX: 25 * Math.sin(t * 1.1),
    ParamAngleY: 12 * Math.sin(t * 0.8 + 1),
    ParamAngleZ: 8 * Math.sin(t * 0.6 + 2),
    ParamBodyAngleX: 8 * Math.sin(t * 0.9),
    ParamEyeLOpen: blink,
    ParamEyeROpen: blink,
    ParamMouthOpenY: 0.5 + 0.5 * Math.sin(t * 6),
  }
}

// Runs on its own worklet runtime and calls the native model from there, as a camera
// frame processor would: nothing here touches the JS thread.
function runOnWorkletRuntime(native: Live2DModel['native'], running: { getDirty(): boolean }) {
  'worklet'
  const start = Date.now()
  const tick = () => {
    if (!running.getDirty()) return
    const values = pose((Date.now() - start) / 1000)
    native.setParameters(Object.keys(values), Object.values(values))
    setTimeout(tick, TICK_MS)
  }
  tick()
}

let runtime: ReturnType<typeof createWorkletRuntime> | null = null
const animateRuntime = () => (runtime ??= createWorkletRuntime({ name: 'animate' }))

/**
 * Drives the model's parameters on their own, with no motion: the stand-in for face tracking.
 * The frame stats over the model show what each way of feeding the values costs.
 */
export function AnimatePanel({ model }: { model: Live2DModel }) {
  const [on, setOn] = useState(true)
  const [source, setSource] = useState<Source>('ui')
  const [smoothing, setSmoothing] = useState(0)
  const [burn, setBurn] = useState(false)
  const jsRate = useJsFrameRate()

  // No motion while running; the parameters are released and the idle motion is back after.
  useEffect(() => {
    if (!on) return
    model.stopMotion()
    model.setIdleMotionEnabled(false)
    return () => {
      model.resetParameters()
      model.setParameterSmoothing(0)
      model.setIdleMotionEnabled(true)
    }
  }, [model, on])

  // 1. The UI thread: a frame callback writes a shared value, useLive2DParameters passes it on.
  const values = useSharedValue<Record<string, number>>({})
  // The clock is a shared start time, not the callback's own `timeSinceFirstFrame`: the callback is
  // registered again whenever the panel re-renders (the JS frame rate readout does, every second),
  // which restarts that clock and would snap the pose back to its start.
  const startedAt = useSharedValue(0)
  const frame = useFrameCallback(({ timestamp }) => {
    if (startedAt.value === 0) startedAt.value = timestamp
    values.value = pose((timestamp - startedAt.value) / 1000)
  }, false)
  const ui = on && source === 'ui'
  useEffect(() => {
    frame.setActive(ui)
  }, [frame, ui])
  useLive2DParameters(ui ? model : null, values, { smoothing })

  // 2. A worklet runtime of its own.
  const worklet = on && source === 'worklet'
  useEffect(() => {
    if (!worklet) return
    model.setParameterSmoothing(smoothing)
    const running = createSynchronizable(true)
    scheduleOnRuntime(animateRuntime(), runOnWorkletRuntime, model.native, running)
    return () => running.setBlocking(false)
  }, [model, worklet, smoothing])

  // 3. The JS thread, as the baseline.
  const js = on && source === 'js'
  useEffect(() => {
    if (!js) return
    model.setParameterSmoothing(smoothing)
    const start = Date.now()
    const timer = setInterval(() => {
      model.setParameters(pose((Date.now() - start) / 1000))
    }, TICK_MS)
    return () => clearInterval(timer)
  }, [model, js, smoothing])

  // A busy JS thread: the UI and worklet runtime sources should not notice, the JS one will.
  useEffect(() => {
    if (!burn) return
    const timer = setInterval(() => {
      const end = Date.now() + 25
      while (Date.now() < end) {}
    }, TICK_MS)
    return () => clearInterval(timer)
  }, [burn])

  return (
    <View style={styles.root}>
      {/* The model's own frame stats are over the model; this is the main JS thread's. */}
      <Text style={styles.jsRate}>
        {jsRate
          ? `JS thread ${jsRate.fps.toFixed(0)} fps · worst gap ${jsRate.worstMs.toFixed(0)} ms`
          : 'JS thread …'}
      </Text>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.row}>
          <Chip label={on ? 'Running' : 'Stopped'} active={on} onPress={() => setOn(!on)} />
          <Chip label="Burn JS thread" active={burn} onPress={() => setBurn(!burn)} />
        </View>
        <Text style={styles.heading}>Parameters come from</Text>
        <View style={styles.row}>
          {SOURCES.map((s) => (
            <Chip
              key={s.source}
              label={s.label}
              sublabel={s.detail}
              active={source === s.source}
              onPress={() => setSource(s.source)}
            />
          ))}
        </View>
        <View style={styles.smoothing}>
          <Text style={styles.heading}>Smoothing</Text>
          <Text style={styles.value}>
            {smoothing === 0 ? 'off' : `${(smoothing * 1000).toFixed(0)} ms`}
          </Text>
        </View>
        <Slider
          value={smoothing}
          min={0}
          max={MAX_SMOOTHING}
          onChange={(v) => setSmoothing(v < 0.01 ? 0 : v)}
        />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  jsRate: {
    paddingHorizontal: 12,
    paddingTop: 4,
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#4a5563',
  },
  container: { padding: 12, gap: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  heading: { fontSize: 13, fontWeight: '700', color: '#4a5563' },
  smoothing: { flexDirection: 'row', justifyContent: 'space-between' },
  value: { fontSize: 12, fontFamily: 'monospace', color: '#4a5563' },
})

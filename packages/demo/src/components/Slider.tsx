import { useState } from 'react'
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { ACCENT } from './Chip'

const THUMB = 20

/** A horizontal slider: drag or tap the track. Callbacks run on the JS thread. */
export function Slider({
  value,
  min,
  max,
  onChange,
}: {
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}) {
  const [width, setWidth] = useState(0)
  const span = max - min
  const travel = Math.max(0, width - THUMB)
  const fraction = span > 0 ? Math.min(1, Math.max(0, (value - min) / span)) : 0

  const set = (x: number) => {
    if (travel <= 0) return
    const f = Math.min(1, Math.max(0, (x - THUMB / 2) / travel))
    onChange(min + f * span)
  }
  // Scrolling the list vertically must win over a slightly diagonal drag.
  const pan = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-4, 4])
    .failOffsetY([-10, 10])
    .onStart((e) => set(e.x))
    .onUpdate((e) => set(e.x))
  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd((e) => set(e.x))

  return (
    <GestureDetector gesture={Gesture.Race(pan, tap)}>
      <View
        style={styles.hit}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      >
        <View style={styles.track} />
        <View style={[styles.fill, { width: THUMB / 2 + fraction * travel }]} />
        <View style={[styles.thumb, { left: fraction * travel }]} />
      </View>
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  hit: { height: 32, justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, backgroundColor: '#dfe4ea' },
  fill: { position: 'absolute', height: 4, borderRadius: 2, backgroundColor: ACCENT },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: ACCENT,
  },
})

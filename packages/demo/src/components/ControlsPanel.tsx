import type { Live2DModel } from '@airisu-dev/react-native-live2d-skia'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ACCENT } from './Chip'
import { ExpressionPicker } from './ExpressionPicker'
import { MotionPicker } from './MotionPicker'
import { ParameterSliders } from './ParameterSliders'

type Tab = 'Expressions' | 'Motions' | 'Parameters'
const TABS: Tab[] = ['Expressions', 'Motions', 'Parameters']

/** Expression and motion pickers and parameter sliders, in a sheet over the bottom of the screen. */
export function ControlsPanel({ model }: { model: Live2DModel }) {
  const [tab, setTab] = useState<Tab | null>('Motions')
  const [expression, setExpression] = useState<string | null>(null)

  return (
    <View style={[styles.sheet, tab !== null && styles.sheetOpen]}>
      <View style={styles.tabs}>
        {TABS.map((t) => (
          // Tapping the open tab again collapses the sheet.
          <Pressable key={t} onPress={() => setTab(t === tab ? null : t)} style={styles.tab}>
            <Text style={[styles.tabText, t === tab && styles.tabTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </View>
      {tab === 'Expressions' && (
        <ExpressionPicker model={model} current={expression} onChange={setExpression} />
      )}
      {tab === 'Motions' && <MotionPicker model={model} />}
      {tab === 'Parameters' && <ParameterSliders model={model} />}
    </View>
  )
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#cfd6df',
  },
  sheetOpen: { height: '45%' },
  tabs: { flexDirection: 'row', justifyContent: 'space-around' },
  tab: { paddingVertical: 12, paddingHorizontal: 8 },
  tabText: { fontSize: 15, fontWeight: '600', color: '#7b8794' },
  tabTextActive: { color: ACCENT },
})

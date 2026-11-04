import type { Live2DModel, MotionInfo } from '@airisu-dev/react-native-live2d-skia'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Chip } from './Chip'

// The file's base name, e.g. 'mtn_01' for 'motions/mtn_01.motion3.json': motions have no names.
function title({ index, file }: MotionInfo) {
  const base = file
    ?.split('/')
    .pop()
    ?.replace(/\.motion3\.json$/, '')
  return base || `${index + 1}`
}

function detail({ index, duration }: MotionInfo) {
  return duration === undefined ? `#${index + 1}` : `#${index + 1} · ${duration.toFixed(1)}s`
}

export function MotionPicker({ model }: { model: Live2DModel }) {
  const groups = Object.entries(model.motions)
  if (groups.length === 0) return <Text style={styles.empty}>This model has no motions.</Text>
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable style={styles.stop} onPress={() => model.stopMotion()}>
        <Text style={styles.stopText}>Stop motion</Text>
      </Pressable>
      {groups.map(([group, motions]) => (
        <View key={group} style={styles.group}>
          <Text style={styles.groupName}>
            {group}
            {group === 'Idle' ? ' (plays on its own)' : ''}
          </Text>
          <View style={styles.row}>
            {motions.map((m) => (
              // 'force' so a click always plays, over the idle motion.
              <Chip
                key={m.index}
                label={title(m)}
                sublabel={detail(m)}
                onPress={() => model.motion(group, m.index, 'force')}
              />
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: 12, gap: 12 },
  empty: { padding: 16, color: '#4a5563' },
  group: { gap: 6 },
  groupName: { fontSize: 13, fontWeight: '700', color: '#4a5563' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stop: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#fde8e8',
  },
  stopText: { fontSize: 14, fontWeight: '600', color: '#b42318' },
})

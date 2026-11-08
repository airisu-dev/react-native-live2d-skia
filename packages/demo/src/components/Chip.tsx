import { Pressable, StyleSheet, Text } from 'react-native'

export const ACCENT = '#208AEF'

export function Chip({
  label,
  sublabel,
  active,
  onPress,
}: {
  label: string
  sublabel?: string
  active?: boolean
  onPress: () => void
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.text, active && styles.textActive]}>{label}</Text>
      {sublabel ? (
        <Text style={[styles.sublabel, active && styles.textActive]}>{sublabel}</Text>
      ) : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#eef1f5',
    alignItems: 'center',
  },
  chipActive: { backgroundColor: ACCENT },
  text: { fontSize: 14, fontWeight: '600', color: '#4a5563' },
  sublabel: { fontSize: 11, color: '#7b8794' },
  textActive: { color: '#fff' },
})

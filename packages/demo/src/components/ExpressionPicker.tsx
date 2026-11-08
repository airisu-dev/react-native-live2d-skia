import type { Live2DModel } from '@airisu-dev/react-native-live2d-skia'
import { ScrollView, StyleSheet, Text } from 'react-native'
import { Chip } from './Chip'

export function ExpressionPicker({
  model,
  current,
  onChange,
}: {
  model: Live2DModel
  /** The expression last picked, `null` for none. */
  current: string | null
  onChange: (name: string | null) => void
}) {
  if (model.expressions.length === 0) {
    return <Text style={styles.empty}>This model has no expressions.</Text>
  }
  return (
    <ScrollView contentContainerStyle={styles.list}>
      <Chip
        label="None"
        active={current === null}
        onPress={() => {
          model.resetExpression()
          onChange(null)
        }}
      />
      {model.expressions.map((e) => (
        <Chip
          key={e.name}
          label={e.name}
          active={current === e.name}
          onPress={() => {
            if (model.expression(e.name)) onChange(e.name)
          }}
        />
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  list: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12 },
  empty: { padding: 16, color: '#4a5563' },
})

import type { Live2DModel } from '@airisu-dev/react-native-live2d-skia'
import { BottomSheet, GridButton, SheetGrid, SheetPill } from '@/components/sheets/BottomSheet'

type ExpressionSheetProps = {
  model: Live2DModel
  selected: string | null
  onSelectedChange: (name: string | null) => void
}

export function ExpressionSheet({ model, selected, onSelectedChange }: ExpressionSheetProps) {
  const clear = () => {
    model.resetExpression()
    onSelectedChange(null)
  }

  const toggle = (name: string) => {
    if (name === selected) {
      clear()
    } else if (model.expression(name)) {
      onSelectedChange(name)
    }
  }

  const names = model.expressionNames

  return (
    <BottomSheet
      title="Expressions"
      actions={<SheetPill label="Clear" icon="rotate-ccw" onPress={clear} />}
    >
      <SheetGrid>
        {names.length === 0 ? (
          <GridButton key="none" label="No expressions" disabled />
        ) : (
          names.map((name) => {
            const isSelected = name === selected
            return (
              <GridButton
                key={name}
                label={name}
                selected={isSelected}
                icon={isSelected ? 'check' : undefined}
                onPress={() => toggle(name)}
              />
            )
          })
        )}
      </SheetGrid>
    </BottomSheet>
  )
}

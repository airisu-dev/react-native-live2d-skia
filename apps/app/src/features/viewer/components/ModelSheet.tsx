import Feather from '@expo/vector-icons/Feather'
import { router } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { BottomSheet, GridButton, SheetGrid, SheetPill } from '@/components/sheets/BottomSheet'
import { useSheetClose } from '@/components/sheets/sheetContext'
import { useLibrary } from '@/features/library/LibraryProvider'
import { colors, radii } from '@/theme'

export function ModelSheet() {
  const { models, activeModel, setActive, startImport } = useLibrary()
  const close = useSheetClose()

  // Each action runs once the native sheet is gone, so nothing is left on top of the next
  // screen, the import overlay or a freshly mounted viewer.
  const manage = () => close(() => router.push('/settings'))

  const pick = (id: string) => {
    if (id === activeModel?.id) close()
    else close(() => setActive(id))
  }

  const importZip = () => close(startImport)

  return (
    <BottomSheet
      title="Models"
      actions={<SheetPill label="Manage" icon="settings" onPress={manage} />}
    >
      <SheetGrid>
        {models.map((record) => {
          const active = record.id === activeModel?.id
          return (
            <GridButton
              key={record.id}
              label={record.name}
              selected={active}
              style={styles.modelCell}
              leading={
                <View style={[styles.thumb, active && styles.thumbActive]}>
                  <Text style={[styles.thumbLetter, active && styles.thumbLetterActive]}>
                    {record.name.trim().charAt(0).toUpperCase() || '?'}
                  </Text>
                </View>
              }
              trailing={
                active ? <Feather name="check" size={16} color={colors.accentText} /> : undefined
              }
              labelStyle={styles.modelName}
              onPress={() => pick(record.id)}
            />
          )
        })}
        <GridButton
          key="import"
          label="Import .zip"
          style={[styles.modelCell, styles.importCell]}
          labelStyle={styles.importText}
          leading={<Feather name="plus" size={16} color={colors.accentText} />}
          onPress={importZip}
        />
      </SheetGrid>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  modelCell: {
    minHeight: 52,
    paddingHorizontal: 10,
  },
  modelName: {
    flex: 1,
  },
  thumb: {
    width: 32,
    height: 32,
    borderRadius: radii.thumb,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbActive: {
    backgroundColor: colors.accentThumb,
  },
  thumbLetter: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '700',
  },
  thumbLetterActive: {
    color: colors.accentText,
  },
  importCell: {
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
  },
  importText: {
    color: colors.accentText,
    fontWeight: '700',
  },
})

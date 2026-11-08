import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { StyleSheet } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { ImportSheet } from '@/features/library/components/ImportSheet'
import { LibraryProvider } from '@/features/library/LibraryProvider'
import { colors } from '@/theme'

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <LibraryProvider>
        <Stack
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.stage } }}
        />
        <ImportSheet />
        <StatusBar style="light" />
      </LibraryProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.stage,
  },
})

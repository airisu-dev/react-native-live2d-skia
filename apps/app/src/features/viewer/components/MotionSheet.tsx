import type { Live2DModel } from '@airisu-dev/react-native-live2d-skia'
import { useEffect, useState } from 'react'
import { BottomSheet, GridButton, SheetGrid, SheetPill } from '@/components/sheets/BottomSheet'

const POLL_MS = 250

type MotionRef = { group: string; index: number }

type MotionSheetProps = {
  model: Live2DModel
}

function motionLabel(group: string, index: number, count: number): string {
  return count === 1 ? group : `${group} ${index + 1}`
}

export function MotionSheet({ model }: MotionSheetProps) {
  const [playing, setPlaying] = useState<MotionRef | null>(null)
  const [loop, setLoop] = useState(false)

  // Idle motions are off for the whole viewer (ModelStage), so isMotionPlaying() turns false
  // as soon as the picked motion ends.
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => {
      if (model.isMotionPlaying()) return
      if (loop) {
        model.motion(playing.group, playing.index, 'force')
      } else {
        setPlaying(null)
      }
    }, POLL_MS)
    return () => clearInterval(id)
  }, [model, playing, loop])

  const play = (group: string, index: number) => {
    setPlaying(model.motion(group, index, 'force') ? { group, index } : null)
  }

  const reset = () => {
    // No resetParameters(): releasing held values (e.g. face tracking) would make them jump.
    model.resetPose()
    model.resetFocus()
    setPlaying(null)
  }

  const toggleLoop = () => setLoop((on) => !on)

  return (
    <BottomSheet
      title="Motions"
      actions={
        <>
          <SheetPill label="Loop" icon="repeat" active={loop} onPress={toggleLoop} />
          <SheetPill label="Reset" icon="rotate-ccw" onPress={reset} />
        </>
      }
    >
      <SheetGrid>
        {model.motionGroups.flatMap((group) => {
          const entries = model.motions[group] ?? []
          return entries.map((motion) => {
            const selected = playing?.group === group && playing.index === motion.index
            return (
              <GridButton
                key={`${group}:${motion.index}`}
                label={motionLabel(group, motion.index, entries.length)}
                selected={selected}
                icon={selected ? 'bar-chart-2' : undefined}
                onPress={() => play(group, motion.index)}
              />
            )
          })
        })}
      </SheetGrid>
    </BottomSheet>
  )
}

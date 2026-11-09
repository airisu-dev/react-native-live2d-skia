export type Fit = { x: number; y: number; scale: number }

export type Size = { width: number; height: number }

export type FitPadding = { top: number; bottom: number; left: number; right: number }

export const STAGE_PADDING: FitPadding = { top: 110, bottom: 120, left: 16, right: 16 }

export const IDENTITY_FIT: Fit = { x: 0, y: 0, scale: 1 }

export function fitModel(model: Size, stage: Size, padding: FitPadding = STAGE_PADDING): Fit {
  if (model.width <= 0 || model.height <= 0 || stage.width <= 0 || stage.height <= 0) {
    return IDENTITY_FIT
  }
  let box = {
    x: padding.left,
    y: padding.top,
    width: stage.width - padding.left - padding.right,
    height: stage.height - padding.top - padding.bottom,
  }
  if (box.width <= 0 || box.height <= 0) box = { x: 0, y: 0, ...stage }
  const scale = Math.min(box.width / model.width, box.height / model.height)
  return {
    x: box.x + (box.width - model.width * scale) / 2,
    y: box.y + (box.height - model.height * scale) / 2,
    scale,
  }
}

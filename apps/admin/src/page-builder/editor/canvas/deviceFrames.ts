import type { Device } from '../core/types'

export interface DeviceFrame {
  label: string
  /** CSS width of the canvas frame. */
  width: string
  /** Shown in the canvas status bar. */
  hint: string
}

export const DEVICE_FRAMES: Record<Device, DeviceFrame> = {
  desktop: { label: 'Desktop', width: '100%', hint: '≥ 1024px' },
  tablet: { label: 'Tablet', width: '834px', hint: '834px' },
  mobile: { label: 'Mobile', width: '390px', hint: '390px' },
}

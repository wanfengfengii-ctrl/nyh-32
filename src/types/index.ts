export interface ColorItem {
  id: string
  name: string
  value: string
}

export type BeatGrid = (string | null)[][]

export interface LayerItem {
  id: string
  name: string
  visible: boolean
  locked: boolean
  opacity: number
  order: number
  grid: BeatGrid
}

export interface PatternSchema {
  version: string
  name: string
  warpCount: number
  weftCycle: number
  colors: ColorItem[]
  grid: BeatGrid
  layers: LayerItem[]
  activeLayerId: string
  createdAt: string
  updatedAt: string
}

export interface ConsumptionItem {
  colorId: string
  colorName: string
  colorValue: string
  count: number
  percentage: number
}

export interface LayerConsumption {
  layerId: string
  layerName: string
  stats: ConsumptionItem[]
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export const SCHEMA_VERSION = '2.0.0'

export const DEFAULT_COLORS: ColorItem[] = [
  { id: 'color-1', name: '米白', value: '#F5F0E6' },
  { id: 'color-2', name: '朱砂红', value: '#C84B31' },
  { id: 'color-3', name: '藏青', value: '#2C3E50' },
  { id: 'color-4', name: '草木绿', value: '#7CB342' },
  { id: 'color-5', name: '金秋黄', value: '#F9A825' }
]

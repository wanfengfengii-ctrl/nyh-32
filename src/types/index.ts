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
  processScheduling?: ProcessSchedulingModule
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

export const SCHEMA_VERSION = '2.1.0'

export interface LayerProcessInfo {
  layerId: string
  layerName: string
  description: string
  cellCount: number
}

export interface ProcessSheetData {
  name: string
  warpCount: number
  weftCycle: number
  totalCells: number
  filledCells: number
  fillRate: number
  colors: ColorItem[]
  usedColors: ColorItem[]
  layers: LayerProcessInfo[]
  totalConsumption: ConsumptionItem[]
  layerConsumptions: LayerConsumption[]
  suggestedRepeats: number
  totalWarpBeats: number
  totalWeftBeats: number
  operationNotes: string[]
  createdAt: string
}

export interface SchedulingStep {
  id: string
  stepIndex: number
  beatIndex: number
  repeatIndex: number
  colorId: string
  colorName: string
  colorValue: string
  description: string
  warpPositions: number[]
  completed: boolean
}

export interface SchedulingData {
  steps: SchedulingStep[]
  currentStepIndex: number
  filterColorId: string | null
  repeatCount: number
  completedCount: number
  totalCount: number
}

export interface SchedulingState {
  completedStepIds: string[]
  currentStepId: string | null
  filterColorId: string | null
  repeatCount: number
}

export interface ProcessSchedulingModule {
  scheduling: SchedulingState
  notes: string[]
}

export const DEFAULT_COLORS: ColorItem[] = [
  { id: 'color-1', name: '米白', value: '#F5F0E6' },
  { id: 'color-2', name: '朱砂红', value: '#C84B31' },
  { id: 'color-3', name: '藏青', value: '#2C3E50' },
  { id: 'color-4', name: '草木绿', value: '#7CB342' },
  { id: 'color-5', name: '金秋黄', value: '#F9A825' }
]

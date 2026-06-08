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
  reviewModule?: ReviewModule
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

export const SCHEMA_VERSION = '3.0.0'

export type ReviewStatus = 'pending' | 'in-review' | 'approved' | 'rejected' | 'needs-revision'

export interface ReviewComment {
  id: string
  author: string
  content: string
  createdAt: string
  resolved: boolean
  resolvedAt?: string
  resolvedBy?: string
}

export interface AnnotationTarget {
  type: 'note' | 'color' | 'layer' | 'scheduling-step'
  targetId: string
  targetIndex?: number
}

export interface Annotation {
  id: string
  target: AnnotationTarget
  content: string
  author: string
  createdAt: string
  updatedAt: string
  resolved: boolean
  resolvedAt?: string
  resolvedBy?: string
}

export interface SampleVersionSnapshot {
  warpCount: number
  weftCycle: number
  colors: ColorItem[]
  grid: BeatGrid
  layers: LayerItem[]
  processNotes: string[]
  scheduling: SchedulingState
  totalConsumption: ConsumptionItem[]
  layerConsumptions: LayerConsumption[]
  suggestedRepeats: number
  schedulingSteps: SchedulingStep[]
}

export interface SampleVersion {
  id: string
  versionNumber: number
  name: string
  description: string
  status: ReviewStatus
  assignee: string
  createdAt: string
  updatedAt: string
  snapshot: SampleVersionSnapshot
  reviewConclusion?: string
  reviewedAt?: string
  reviewedBy?: string
  annotations: Annotation[]
  comments: ReviewComment[]
}

export interface ReviewModule {
  versions: SampleVersion[]
  currentVersionId: string | null
  activeReviewTab: 'versions' | 'comparison' | 'annotations'
  compareVersionIds: [string, string] | null
}

export interface DiffChangeItem<T = unknown> {
  type: 'added' | 'removed' | 'modified' | 'unchanged'
  key: string
  oldValue?: T
  newValue?: T
}

export interface ComparisonResult {
  pattern: DiffChangeItem[]
  colors: DiffChangeItem<ColorItem>[]
  consumption: DiffChangeItem<ConsumptionItem>[]
  suggestedRepeats: DiffChangeItem<number>
  layers: DiffChangeItem<LayerProcessInfo>[]
  schedulingSteps: DiffChangeItem<SchedulingStep>[]
  notes: DiffChangeItem<string>[]
  totalChanges: number
}

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

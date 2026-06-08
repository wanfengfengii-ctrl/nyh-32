import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type {
  ColorItem,
  BeatGrid,
  PatternSchema,
  ConsumptionItem,
  LayerItem,
  LayerConsumption,
  LayerProcessInfo,
  ProcessSheetData,
  SchedulingStep,
  SchedulingData,
  SchedulingState,
  ProcessSchedulingModule,
  SampleVersion,
  SampleVersionSnapshot,
  Annotation,
  ReviewComment,
  ReviewModule,
  ReviewStatus,
  ComparisonResult,
  DiffChangeItem
} from '@/types'
import { DEFAULT_COLORS, SCHEMA_VERSION } from '@/types'
import {
  createEmptyGrid,
  resizeGrid,
  calculateConsumption,
  calculateTotalConsumption,
  composeLayers,
  downloadJsonFile,
  createDefaultLayer,
  cloneGrid,
  cloneLayer,
  mirrorHorizontal,
  mirrorVertical,
  shiftHorizontal,
  shiftVertical,
  copyRegion,
  pasteRegion,
  generateLayerId,
  generateProcessSheet,
  generateSchedulingSteps,
  buildSchedulingData,
  defaultSchedulingState,
  exportSchedulingAsJson
} from '@/utils/pattern'
import { validatePatternSchema, generateColorId, validatePositiveInteger, validateOpacity } from '@/utils/validator'

const WARP_MIN = 1
const WARP_MAX = 200
const WEFT_MIN = 1
const WEFT_MAX = 100
const MAX_HISTORY_SIZE = 50

interface HistoryState {
  layers: LayerItem[]
  activeLayerId: string
  warpCount: number
  weftCycle: number
  colors: ColorItem[]
  grid: BeatGrid
}

export const usePatternStore = defineStore('pattern', () => {
  const warpCount = ref(16)
  const weftCycle = ref(8)
  const colors = ref<ColorItem[]>(JSON.parse(JSON.stringify(DEFAULT_COLORS)))
  const grid = ref<BeatGrid>(createEmptyGrid(16, 8))
  const currentColorId = ref(colors.value[0].id)
  const previewRepeat = ref(6)
  const schemaName = ref('未命名纹样')

  const layers = ref<LayerItem[]>([createDefaultLayer(16, 8, '图层 1', 0)])
  const activeLayerId = ref(layers.value[0].id)

  const schedulingState = ref<SchedulingState>(defaultSchedulingState())
  const processNotes = ref<string[]>([])

  const reviewVersions = ref<SampleVersion[]>([])
  const currentReviewVersionId = ref<string | null>(null)
  const activeReviewTab = ref<'versions' | 'comparison' | 'annotations'>('versions')
  const compareVersionIds = ref<[string, string] | null>(null)

  const history = ref<HistoryState[]>([])
  const historyIndex = ref(-1)
  let historyPaused = false

  const activeLayer = computed(() => {
    return layers.value.find(l => l.id === activeLayerId.value) || layers.value[0]
  })

  const sortedLayers = computed(() => {
    return [...layers.value].sort((a, b) => a.order - b.order)
  })

  const composedGrid = computed(() => {
    return composeLayers(layers.value, warpCount.value, weftCycle.value)
  })

  const currentColor = computed(() => {
    return colors.value.find(c => c.id === currentColorId.value) || colors.value[0]
  })

  const consumptionStats = computed<ConsumptionItem[]>(() => {
    return calculateTotalConsumption(layers.value, colors.value)
  })

  const layerConsumptions = computed<LayerConsumption[]>(() => {
    return layers.value.map(layer => ({
      layerId: layer.id,
      layerName: layer.name,
      stats: calculateConsumption(layer.grid, colors.value)
    }))
  })

  const totalCells = computed(() => warpCount.value * weftCycle.value)

  const filledCells = computed(() => {
    let count = 0
    composedGrid.value.forEach(row => {
      row.forEach(cell => {
        if (cell !== null) count++
      })
    })
    return count
  })

  const processSheet = computed<ProcessSheetData>(() => {
    return generateProcessSheet(
      schemaName.value,
      warpCount.value,
      weftCycle.value,
      colors.value,
      layers.value,
      composedGrid.value,
      consumptionStats.value,
      layerConsumptions.value
    )
  })

  const schedulingSteps = computed<SchedulingStep[]>(() => {
    return generateSchedulingSteps(
      composedGrid.value,
      colors.value,
      schedulingState.value.repeatCount
    )
  })

  const schedulingData = computed<SchedulingData>(() => {
    return buildSchedulingData(schedulingSteps.value, schedulingState.value)
  })

  const canUndo = computed(() => historyIndex.value > 0)
  const canRedo = computed(() => historyIndex.value < history.value.length - 1)

  const currentReviewVersion = computed<SampleVersion | null>(() => {
    if (!currentReviewVersionId.value) return null
    return reviewVersions.value.find(v => v.id === currentReviewVersionId.value) || null
  })

  const sortedReviewVersions = computed<SampleVersion[]>(() => {
    return [...reviewVersions.value].sort((a, b) => a.versionNumber - b.versionNumber)
  })

  const reviewComparisonResult = computed<ComparisonResult | null>(() => {
    if (!compareVersionIds.value) return null
    const [id1, id2] = compareVersionIds.value
    const v1 = reviewVersions.value.find(v => v.id === id1)
    const v2 = reviewVersions.value.find(v => v.id === id2)
    if (!v1 || !v2) return null
    return compareSampleVersions(v1, v2)
  })

  function pauseHistory() {
    historyPaused = true
  }

  function resumeHistory() {
    historyPaused = false
  }

  function saveHistory() {
    if (historyPaused) return

    const state: HistoryState = {
      layers: layers.value.map(l => cloneLayer(l)),
      activeLayerId: activeLayerId.value,
      warpCount: warpCount.value,
      weftCycle: weftCycle.value,
      colors: JSON.parse(JSON.stringify(colors.value)),
      grid: cloneGrid(grid.value)
    }

    if (historyIndex.value < history.value.length - 1) {
      history.value = history.value.slice(0, historyIndex.value + 1)
    }

    history.value.push(state)

    if (history.value.length > MAX_HISTORY_SIZE) {
      history.value.shift()
    } else {
      historyIndex.value++
    }
  }

  function undo() {
    if (!canUndo.value) return false
    historyIndex.value--
    restoreState(history.value[historyIndex.value])
    return true
  }

  function redo() {
    if (!canRedo.value) return false
    historyIndex.value++
    restoreState(history.value[historyIndex.value])
    return true
  }

  function restoreState(state: HistoryState) {
    pauseHistory()
    layers.value = state.layers.map(l => cloneLayer(l))
    activeLayerId.value = state.activeLayerId
    warpCount.value = state.warpCount
    weftCycle.value = state.weftCycle
    colors.value = JSON.parse(JSON.stringify(state.colors))
    grid.value = cloneGrid(state.grid)
    resumeHistory()
  }

  function initHistory() {
    history.value = []
    historyIndex.value = -1
    saveHistory()
  }

  function setWarpCount(count: number) {
    if (!validatePositiveInteger(count)) return false
    if (count < WARP_MIN || count > WARP_MAX) return false
    warpCount.value = count
    grid.value = resizeGrid(grid.value, count, weftCycle.value)
    layers.value.forEach(layer => {
      layer.grid = resizeGrid(layer.grid, count, weftCycle.value)
    })
    if (!colors.value.find(c => c.id === currentColorId.value)) {
      currentColorId.value = colors.value[0]?.id || ''
    }
    saveHistory()
    return true
  }

  function setWeftCycle(cycle: number) {
    if (!validatePositiveInteger(cycle)) return false
    if (cycle < WEFT_MIN || cycle > WEFT_MAX) return false
    weftCycle.value = cycle
    grid.value = resizeGrid(grid.value, warpCount.value, cycle)
    layers.value.forEach(layer => {
      layer.grid = resizeGrid(layer.grid, warpCount.value, cycle)
    })
    saveHistory()
    return true
  }

  function setCurrentColor(colorId: string) {
    if (colors.value.find(c => c.id === colorId)) {
      currentColorId.value = colorId
    }
  }

  function setCell(row: number, col: number, colorId: string | null) {
    const layer = activeLayer.value
    if (!layer || layer.locked) return

    if (
      row >= 0 &&
      row < weftCycle.value &&
      col >= 0 &&
      col < warpCount.value
    ) {
      if (colorId === null || colors.value.find(c => c.id === colorId)) {
        layer.grid[row][col] = colorId
        grid.value = composedGrid.value
        saveHistory()
      }
    }
  }

  function clearGrid() {
    const layer = activeLayer.value
    if (!layer || layer.locked) return
    layer.grid = createEmptyGrid(warpCount.value, weftCycle.value)
    grid.value = composedGrid.value
    saveHistory()
  }

  function fillGrid(colorId: string) {
    const layer = activeLayer.value
    if (!layer || layer.locked) return
    if (!colors.value.find(c => c.id === colorId)) return
    layer.grid = layer.grid.map(row => row.map(() => colorId))
    grid.value = composedGrid.value
    saveHistory()
  }

  function addColor(name: string, value: string) {
    const newColor: ColorItem = {
      id: generateColorId(),
      name,
      value
    }
    colors.value.push(newColor)
    return newColor
  }

  function removeColor(colorId: string) {
    if (colors.value.length <= 2) return false
    const index = colors.value.findIndex(c => c.id === colorId)
    if (index === -1) return false

    colors.value.splice(index, 1)
    layers.value.forEach(layer => {
      layer.grid = layer.grid.map(row =>
        row.map(cell => (cell === colorId ? null : cell))
      )
    })
    grid.value = composedGrid.value

    if (currentColorId.value === colorId) {
      currentColorId.value = colors.value[0]?.id || ''
    }

    saveHistory()
    return true
  }

  function updateColor(colorId: string, data: Partial<ColorItem>) {
    const color = colors.value.find(c => c.id === colorId)
    if (color) {
      Object.assign(color, data)
    }
  }

  function setPreviewRepeat(count: number) {
    previewRepeat.value = Math.max(1, Math.min(50, count))
  }

  function setSchemaName(name: string) {
    schemaName.value = name
  }

  function setActiveLayer(layerId: string) {
    if (layers.value.find(l => l.id === layerId)) {
      activeLayerId.value = layerId
    }
  }

  function addLayer(name?: string) {
    const maxOrder = layers.value.reduce((max, l) => Math.max(max, l.order), -1)
    const newLayer = createDefaultLayer(
      warpCount.value,
      weftCycle.value,
      name || `图层 ${layers.value.length + 1}`,
      maxOrder + 1
    )
    layers.value.push(newLayer)
    activeLayerId.value = newLayer.id
    grid.value = composedGrid.value
    saveHistory()
    return newLayer
  }

  function removeLayer(layerId: string) {
    if (layers.value.length <= 1) return false
    const index = layers.value.findIndex(l => l.id === layerId)
    if (index === -1) return false

    layers.value.splice(index, 1)

    if (activeLayerId.value === layerId) {
      activeLayerId.value = layers.value[0]?.id || ''
    }

    grid.value = composedGrid.value
    saveHistory()
    return true
  }

  function duplicateLayer(layerId: string) {
    const layer = layers.value.find(l => l.id === layerId)
    if (!layer) return null

    const maxOrder = layers.value.reduce((max, l) => Math.max(max, l.order), -1)
    const newLayer: LayerItem = {
      ...cloneLayer(layer),
      id: generateLayerId(),
      name: `${layer.name} 副本`,
      order: maxOrder + 1
    }
    layers.value.push(newLayer)
    activeLayerId.value = newLayer.id
    grid.value = composedGrid.value
    saveHistory()
    return newLayer
  }

  function renameLayer(layerId: string, name: string) {
    const layer = layers.value.find(l => l.id === layerId)
    if (layer && name.trim()) {
      layer.name = name.trim()
      saveHistory()
    }
  }

  function toggleLayerVisibility(layerId: string) {
    const layer = layers.value.find(l => l.id === layerId)
    if (layer) {
      layer.visible = !layer.visible
      grid.value = composedGrid.value
      saveHistory()
    }
  }

  function toggleLayerLock(layerId: string) {
    const layer = layers.value.find(l => l.id === layerId)
    if (layer) {
      layer.locked = !layer.locked
    }
  }

  function setLayerOpacity(layerId: string, opacity: number) {
    if (!validateOpacity(opacity)) return
    const layer = layers.value.find(l => l.id === layerId)
    if (layer) {
      layer.opacity = opacity
      saveHistory()
    }
  }

  function moveLayerUp(layerId: string) {
    const layer = layers.value.find(l => l.id === layerId)
    if (!layer) return

    const upperLayer = layers.value.find(l => l.order === layer.order + 1)
    if (upperLayer) {
      layer.order++
      upperLayer.order--
      saveHistory()
    }
  }

  function moveLayerDown(layerId: string) {
    const layer = layers.value.find(l => l.id === layerId)
    if (!layer) return

    const lowerLayer = layers.value.find(l => l.order === layer.order - 1)
    if (lowerLayer) {
      layer.order--
      lowerLayer.order++
      saveHistory()
    }
  }

  function mirrorCurrentLayerHorizontal() {
    const layer = activeLayer.value
    if (!layer || layer.locked) return
    layer.grid = mirrorHorizontal(layer.grid)
    grid.value = composedGrid.value
    saveHistory()
  }

  function mirrorCurrentLayerVertical() {
    const layer = activeLayer.value
    if (!layer || layer.locked) return
    layer.grid = mirrorVertical(layer.grid)
    grid.value = composedGrid.value
    saveHistory()
  }

  function shiftCurrentLayerHorizontal(offset: number) {
    const layer = activeLayer.value
    if (!layer || layer.locked) return
    layer.grid = shiftHorizontal(layer.grid, offset)
    grid.value = composedGrid.value
    saveHistory()
  }

  function shiftCurrentLayerVertical(offset: number) {
    const layer = activeLayer.value
    if (!layer || layer.locked) return
    layer.grid = shiftVertical(layer.grid, offset)
    grid.value = composedGrid.value
    saveHistory()
  }

  const clipboard = ref<BeatGrid | null>(null)

  function copySelection(startRow: number, startCol: number, endRow: number, endCol: number) {
    const layer = activeLayer.value
    if (!layer) return
    clipboard.value = copyRegion(layer.grid, startRow, startCol, endRow, endCol)
  }

  function pasteSelection(targetRow: number, targetCol: number) {
    const layer = activeLayer.value
    if (!layer || layer.locked || !clipboard.value) return
    layer.grid = pasteRegion(layer.grid, clipboard.value, targetRow, targetCol)
    grid.value = composedGrid.value
    saveHistory()
  }

  function hasClipboardData(): boolean {
    return clipboard.value !== null && clipboard.value.length > 0
  }

  function setSchedulingRepeatCount(count: number) {
    schedulingState.value.repeatCount = Math.max(1, Math.min(100, Math.floor(count)))
    if (schedulingState.value.currentStepId) {
      const steps = schedulingSteps.value
      const currentStep = steps.find(s => s.id === schedulingState.value.currentStepId)
      if (!currentStep || currentStep.repeatIndex >= schedulingState.value.repeatCount) {
        schedulingState.value.currentStepId = steps[0]?.id || null
      }
    }
  }

  function setSchedulingFilterColor(colorId: string | null) {
    schedulingState.value.filterColorId = colorId
    const filtered = schedulingData.value.steps
    if (filtered.length > 0 && schedulingState.value.currentStepId) {
      const exists = filtered.some(s => s.id === schedulingState.value.currentStepId)
      if (!exists) {
        schedulingState.value.currentStepId = filtered[0].id
      }
    }
  }

  function setCurrentSchedulingStep(stepId: string) {
    const steps = schedulingData.value.steps
    if (steps.find(s => s.id === stepId)) {
      schedulingState.value.currentStepId = stepId
    }
  }

  function toggleStepCompleted(stepId: string) {
    const idx = schedulingState.value.completedStepIds.indexOf(stepId)
    if (idx === -1) {
      schedulingState.value.completedStepIds.push(stepId)
    } else {
      schedulingState.value.completedStepIds.splice(idx, 1)
    }
  }

  function markStepCompleted(stepId: string) {
    if (!schedulingState.value.completedStepIds.includes(stepId)) {
      schedulingState.value.completedStepIds.push(stepId)
    }
  }

  function markStepIncomplete(stepId: string) {
    const idx = schedulingState.value.completedStepIds.indexOf(stepId)
    if (idx !== -1) {
      schedulingState.value.completedStepIds.splice(idx, 1)
    }
  }

  function goToNextStep() {
    const steps = schedulingData.value.steps
    const currentIdx = steps.findIndex(s => s.id === schedulingState.value.currentStepId)
    if (currentIdx < steps.length - 1) {
      schedulingState.value.currentStepId = steps[currentIdx + 1].id
    }
  }

  function goToPrevStep() {
    const steps = schedulingData.value.steps
    const currentIdx = steps.findIndex(s => s.id === schedulingState.value.currentStepId)
    if (currentIdx > 0) {
      schedulingState.value.currentStepId = steps[currentIdx - 1].id
    }
  }

  function resetSchedulingProgress() {
    schedulingState.value.completedStepIds = []
    schedulingState.value.currentStepId = schedulingData.value.steps[0]?.id || null
  }

  function exportSchedulingJson() {
    exportSchedulingAsJson(schedulingSteps.value, processSheet.value)
  }

  function setProcessNotes(notes: string[]) {
    processNotes.value = [...notes]
  }

  function addProcessNote(note: string) {
    if (note.trim()) {
      processNotes.value.push(note.trim())
    }
  }

  function removeProcessNote(index: number) {
    if (index >= 0 && index < processNotes.value.length) {
      processNotes.value.splice(index, 1)
    }
  }

  function updateProcessNote(index: number, note: string) {
    if (index >= 0 && index < processNotes.value.length) {
      processNotes.value[index] = note
    }
  }

  function exportSchema() {
    const processScheduling: ProcessSchedulingModule = {
      scheduling: {
        completedStepIds: [...schedulingState.value.completedStepIds],
        currentStepId: schedulingState.value.currentStepId,
        filterColorId: schedulingState.value.filterColorId,
        repeatCount: schedulingState.value.repeatCount
      },
      notes: [...processNotes.value]
    }

    const reviewModule: ReviewModule = {
      versions: JSON.parse(JSON.stringify(reviewVersions.value)),
      currentVersionId: currentReviewVersionId.value,
      activeReviewTab: activeReviewTab.value,
      compareVersionIds: compareVersionIds.value ? [...compareVersionIds.value] as [string, string] : null
    }

    const schema: PatternSchema = {
      version: SCHEMA_VERSION,
      name: schemaName.value,
      warpCount: warpCount.value,
      weftCycle: weftCycle.value,
      colors: JSON.parse(JSON.stringify(colors.value)),
      grid: cloneGrid(composedGrid.value),
      layers: layers.value.map(l => cloneLayer(l)),
      activeLayerId: activeLayerId.value,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      processScheduling,
      reviewModule
    }

    const filename = `${schemaName.value || '纹样方案'}-${Date.now()}.json`
    downloadJsonFile(schema, filename)
  }

  function importSchema(schemaData: unknown): { success: boolean; errors: string[] } {
    const validation = validatePatternSchema(schemaData)

    if (!validation.valid) {
      return { success: false, errors: validation.errors }
    }

    const schema = schemaData as PatternSchema

    pauseHistory()

    warpCount.value = schema.warpCount
    weftCycle.value = schema.weftCycle
    colors.value = JSON.parse(JSON.stringify(schema.colors))
    grid.value = cloneGrid(schema.grid)
    schemaName.value = schema.name
    currentColorId.value = colors.value[0]?.id || ''

    if (schema.layers && schema.layers.length > 0) {
      layers.value = schema.layers.map(l => cloneLayer(l))
      activeLayerId.value = schema.activeLayerId || layers.value[0].id
    } else {
      const defaultLayer = createDefaultLayer(schema.warpCount, schema.weftCycle, '图层 1', 0)
      defaultLayer.grid = cloneGrid(schema.grid)
      layers.value = [defaultLayer]
      activeLayerId.value = defaultLayer.id
    }

    grid.value = composedGrid.value

    if (schema.processScheduling) {
      const ps = schema.processScheduling
      schedulingState.value = {
        completedStepIds: Array.isArray(ps.scheduling?.completedStepIds)
          ? [...ps.scheduling.completedStepIds]
          : [],
        currentStepId: typeof ps.scheduling?.currentStepId === 'string'
          ? ps.scheduling.currentStepId
          : null,
        filterColorId: typeof ps.scheduling?.filterColorId === 'string'
          ? ps.scheduling.filterColorId
          : null,
        repeatCount: typeof ps.scheduling?.repeatCount === 'number'
          ? Math.max(1, Math.min(100, ps.scheduling.repeatCount))
          : 6
      }
      processNotes.value = Array.isArray(ps.notes) ? [...ps.notes] : []
    } else {
      schedulingState.value = defaultSchedulingState()
      processNotes.value = []
    }

    if (schema.reviewModule && Array.isArray(schema.reviewModule.versions)) {
      const rm = schema.reviewModule
      reviewVersions.value = JSON.parse(JSON.stringify(rm.versions))
      currentReviewVersionId.value = typeof rm.currentVersionId === 'string'
        ? rm.currentVersionId
        : (reviewVersions.value[0]?.id || null)
      activeReviewTab.value = rm.activeReviewTab || 'versions'
      compareVersionIds.value = rm.compareVersionIds || null
    } else {
      reviewVersions.value = []
      currentReviewVersionId.value = null
      activeReviewTab.value = 'versions'
      compareVersionIds.value = null
    }

    resumeHistory()
    initHistory()

    return { success: true, errors: [] }
  }

  function generateVersionId(): string {
    return `version-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  function generateAnnotationId(): string {
    return `annotation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  function generateCommentId(): string {
    return `comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  function createCurrentSnapshot(): SampleVersionSnapshot {
    return {
      warpCount: warpCount.value,
      weftCycle: weftCycle.value,
      colors: JSON.parse(JSON.stringify(colors.value)),
      grid: cloneGrid(composedGrid.value),
      layers: layers.value.map(l => cloneLayer(l)),
      processNotes: [...processNotes.value],
      scheduling: {
        completedStepIds: [...schedulingState.value.completedStepIds],
        currentStepId: schedulingState.value.currentStepId,
        filterColorId: schedulingState.value.filterColorId,
        repeatCount: schedulingState.value.repeatCount
      },
      totalConsumption: JSON.parse(JSON.stringify(consumptionStats.value)),
      layerConsumptions: JSON.parse(JSON.stringify(layerConsumptions.value)),
      suggestedRepeats: processSheet.value.suggestedRepeats,
      schedulingSteps: JSON.parse(JSON.stringify(schedulingSteps.value))
    }
  }

  function createSampleVersion(name: string, description: string = '', assignee: string = '未分配'): SampleVersion {
    const nextVersionNumber = reviewVersions.value.length + 1
    const snapshot = createCurrentSnapshot()
    
    const version: SampleVersion = {
      id: generateVersionId(),
      versionNumber: nextVersionNumber,
      name: name || `版本 ${nextVersionNumber}`,
      description,
      status: 'pending',
      assignee,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      snapshot,
      annotations: [],
      comments: []
    }
    
    reviewVersions.value.push(version)
    currentReviewVersionId.value = version.id
    
    return version
  }

  function updateSampleVersion(versionId: string, data: Partial<SampleVersion>): boolean {
    const version = reviewVersions.value.find(v => v.id === versionId)
    if (!version) return false
    
    Object.assign(version, data, { updatedAt: new Date().toISOString() })
    return true
  }

  function deleteSampleVersion(versionId: string): boolean {
    const index = reviewVersions.value.findIndex(v => v.id === versionId)
    if (index === -1) return false
    
    reviewVersions.value.splice(index, 1)
    
    reviewVersions.value.forEach((v, i) => {
      v.versionNumber = i + 1
    })
    
    if (currentReviewVersionId.value === versionId) {
      currentReviewVersionId.value = reviewVersions.value[0]?.id || null
    }
    
    if (compareVersionIds.value) {
      const [id1, id2] = compareVersionIds.value
      if (id1 === versionId || id2 === versionId) {
        compareVersionIds.value = null
      }
    }
    
    return true
  }

  function setCurrentReviewVersion(versionId: string | null) {
    if (versionId === null || reviewVersions.value.find(v => v.id === versionId)) {
      currentReviewVersionId.value = versionId
    }
  }

  function setActiveReviewTab(tab: 'versions' | 'comparison' | 'annotations') {
    activeReviewTab.value = tab
  }

  function setCompareVersions(versionId1: string, versionId2: string) {
    const v1 = reviewVersions.value.find(v => v.id === versionId1)
    const v2 = reviewVersions.value.find(v => v.id === versionId2)
    if (v1 && v2) {
      compareVersionIds.value = [versionId1, versionId2]
    }
  }

  function clearCompareVersions() {
    compareVersionIds.value = null
  }

  function compareSampleVersions(v1: SampleVersion, v2: SampleVersion): ComparisonResult {
    const s1 = v1.snapshot
    const s2 = v2.snapshot
    const patternDiffs: DiffChangeItem[] = []
    let totalChanges = 0

    if (s1.warpCount !== s2.warpCount) {
      patternDiffs.push({
        type: 'modified',
        key: 'warpCount',
        oldValue: s1.warpCount,
        newValue: s2.warpCount
      })
      totalChanges++
    }
    if (s1.weftCycle !== s2.weftCycle) {
      patternDiffs.push({
        type: 'modified',
        key: 'weftCycle',
        oldValue: s1.weftCycle,
        newValue: s2.weftCycle
      })
      totalChanges++
    }

    const colorDiffs: DiffChangeItem<ColorItem>[] = []
    const colorMap1 = new Map(s1.colors.map(c => [c.id, c]))
    const colorMap2 = new Map(s2.colors.map(c => [c.id, c]))
    const allColorIds = new Set([...colorMap1.keys(), ...colorMap2.keys()])
    
    allColorIds.forEach(id => {
      const c1 = colorMap1.get(id)
      const c2 = colorMap2.get(id)
      if (c1 && !c2) {
        colorDiffs.push({ type: 'removed', key: id, oldValue: c1 })
        totalChanges++
      } else if (!c1 && c2) {
        colorDiffs.push({ type: 'added', key: id, newValue: c2 })
        totalChanges++
      } else if (c1 && c2 && (c1.name !== c2.name || c1.value !== c2.value)) {
        colorDiffs.push({ type: 'modified', key: id, oldValue: c1, newValue: c2 })
        totalChanges++
      }
    })

    const consumptionDiffs: DiffChangeItem<ConsumptionItem>[] = []
    const consMap1 = new Map(s1.totalConsumption.map(c => [c.colorId, c]))
    const consMap2 = new Map(s2.totalConsumption.map(c => [c.colorId, c]))
    const allConsIds = new Set([...consMap1.keys(), ...consMap2.keys()])
    
    allConsIds.forEach(id => {
      const c1 = consMap1.get(id)
      const c2 = consMap2.get(id)
      if (c1 && !c2) {
        consumptionDiffs.push({ type: 'removed', key: id, oldValue: c1 })
        totalChanges++
      } else if (!c1 && c2) {
        consumptionDiffs.push({ type: 'added', key: id, newValue: c2 })
        totalChanges++
      } else if (c1 && c2 && (c1.count !== c2.count || c1.percentage !== c2.percentage)) {
        consumptionDiffs.push({ type: 'modified', key: id, oldValue: c1, newValue: c2 })
        totalChanges++
      }
    })

    const suggestedRepeatsDiff: DiffChangeItem<number> = {
      type: s1.suggestedRepeats === s2.suggestedRepeats ? 'unchanged' : 'modified',
      key: 'suggestedRepeats',
      oldValue: s1.suggestedRepeats,
      newValue: s2.suggestedRepeats
    }
    if (suggestedRepeatsDiff.type === 'modified') totalChanges++

    function getLayerCellCount(layer: LayerItem): number {
      let count = 0
      layer.grid.forEach(row => {
        row.forEach(cell => {
          if (cell !== null) count++
        })
      })
      return count
    }

    function toLayerProcessInfo(layer: LayerItem, index: number): LayerProcessInfo {
      return {
        layerId: layer.id,
        layerName: layer.name,
        description: `图层 ${index + 1}`,
        cellCount: getLayerCellCount(layer)
      }
    }

    const layerDiffs: DiffChangeItem<LayerProcessInfo>[] = []
    const layerMap1 = new Map(s1.layers.map((l, i) => [l.id, toLayerProcessInfo(l, i)]))
    const layerMap2 = new Map(s2.layers.map((l, i) => [l.id, toLayerProcessInfo(l, i)]))
    const allLayerIds = new Set([...layerMap1.keys(), ...layerMap2.keys()])
    
    allLayerIds.forEach(id => {
      const l1 = layerMap1.get(id)
      const l2 = layerMap2.get(id)
      if (l1 && !l2) {
        layerDiffs.push({ type: 'removed', key: id, oldValue: l1 })
        totalChanges++
      } else if (!l1 && l2) {
        layerDiffs.push({ type: 'added', key: id, newValue: l2 })
        totalChanges++
      } else if (l1 && l2 && (l1.layerName !== l2.layerName || l1.cellCount !== l2.cellCount)) {
        layerDiffs.push({ type: 'modified', key: id, oldValue: l1, newValue: l2 })
        totalChanges++
      }
    })

    const stepDiffs: DiffChangeItem<SchedulingStep>[] = []
    const stepMap1 = new Map(s1.schedulingSteps.map(s => [s.id, s]))
    const stepMap2 = new Map(s2.schedulingSteps.map(s => [s.id, s]))
    const allStepIds = new Set([...stepMap1.keys(), ...stepMap2.keys()])
    
    allStepIds.forEach(id => {
      const st1 = stepMap1.get(id)
      const st2 = stepMap2.get(id)
      if (st1 && !st2) {
        stepDiffs.push({ type: 'removed', key: id, oldValue: st1 })
        totalChanges++
      } else if (!st1 && st2) {
        stepDiffs.push({ type: 'added', key: id, newValue: st2 })
        totalChanges++
      } else if (st1 && st2 && (
        st1.description !== st2.description ||
        st1.colorId !== st2.colorId ||
        st1.warpPositions.length !== st2.warpPositions.length ||
        JSON.stringify(st1.warpPositions) !== JSON.stringify(st2.warpPositions)
      )) {
        stepDiffs.push({ type: 'modified', key: id, oldValue: st1, newValue: st2 })
        totalChanges++
      }
    })

    const noteDiffs: DiffChangeItem<string>[] = []
    const maxLen = Math.max(s1.processNotes.length, s2.processNotes.length)
    for (let i = 0; i < maxLen; i++) {
      const n1 = s1.processNotes[i]
      const n2 = s2.processNotes[i]
      if (n1 === undefined && n2 !== undefined) {
        noteDiffs.push({ type: 'added', key: `note-${i}`, newValue: n2 })
        totalChanges++
      } else if (n1 !== undefined && n2 === undefined) {
        noteDiffs.push({ type: 'removed', key: `note-${i}`, oldValue: n1 })
        totalChanges++
      } else if (n1 !== n2) {
        noteDiffs.push({ type: 'modified', key: `note-${i}`, oldValue: n1, newValue: n2 })
        totalChanges++
      }
    }

    return {
      pattern: patternDiffs,
      colors: colorDiffs,
      consumption: consumptionDiffs,
      suggestedRepeats: suggestedRepeatsDiff,
      layers: layerDiffs,
      schedulingSteps: stepDiffs,
      notes: noteDiffs,
      totalChanges
    }
  }

  function addAnnotation(versionId: string, target: Annotation['target'], content: string, author: string = '当前用户'): Annotation | null {
    const version = reviewVersions.value.find(v => v.id === versionId)
    if (!version) return null

    const annotation: Annotation = {
      id: generateAnnotationId(),
      target,
      content,
      author,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      resolved: false
    }

    version.annotations.push(annotation)
    version.updatedAt = new Date().toISOString()
    return annotation
  }

  function updateAnnotation(versionId: string, annotationId: string, content: string): boolean {
    const version = reviewVersions.value.find(v => v.id === versionId)
    if (!version) return false

    const annotation = version.annotations.find(a => a.id === annotationId)
    if (!annotation) return false

    annotation.content = content
    annotation.updatedAt = new Date().toISOString()
    version.updatedAt = new Date().toISOString()
    return true
  }

  function deleteAnnotation(versionId: string, annotationId: string): boolean {
    const version = reviewVersions.value.find(v => v.id === versionId)
    if (!version) return false

    const index = version.annotations.findIndex(a => a.id === annotationId)
    if (index === -1) return false

    version.annotations.splice(index, 1)
    version.updatedAt = new Date().toISOString()
    return true
  }

  function resolveAnnotation(versionId: string, annotationId: string, resolvedBy: string = '当前用户'): boolean {
    const version = reviewVersions.value.find(v => v.id === versionId)
    if (!version) return false

    const annotation = version.annotations.find(a => a.id === annotationId)
    if (!annotation) return false

    annotation.resolved = true
    annotation.resolvedAt = new Date().toISOString()
    annotation.resolvedBy = resolvedBy
    version.updatedAt = new Date().toISOString()
    return true
  }

  function unresolveAnnotation(versionId: string, annotationId: string): boolean {
    const version = reviewVersions.value.find(v => v.id === versionId)
    if (!version) return false

    const annotation = version.annotations.find(a => a.id === annotationId)
    if (!annotation) return false

    annotation.resolved = false
    annotation.resolvedAt = undefined
    annotation.resolvedBy = undefined
    version.updatedAt = new Date().toISOString()
    return true
  }

  function addReviewComment(versionId: string, content: string, author: string = '当前用户'): ReviewComment | null {
    const version = reviewVersions.value.find(v => v.id === versionId)
    if (!version) return null

    const comment: ReviewComment = {
      id: generateCommentId(),
      author,
      content,
      createdAt: new Date().toISOString(),
      resolved: false
    }

    version.comments.push(comment)
    version.updatedAt = new Date().toISOString()
    return comment
  }

  function updateReviewStatus(versionId: string, status: ReviewStatus): boolean {
    return updateSampleVersion(versionId, { status })
  }

  function updateReviewConclusion(versionId: string, conclusion: string, reviewedBy: string = '当前用户'): boolean {
    return updateSampleVersion(versionId, {
      reviewConclusion: conclusion,
      reviewedAt: new Date().toISOString(),
      reviewedBy
    })
  }

  function getAnnotationsForTarget(versionId: string, targetType: string, targetId: string): Annotation[] {
    const version = reviewVersions.value.find(v => v.id === versionId)
    if (!version) return []
    return version.annotations.filter(
      a => a.target.type === targetType && a.target.targetId === targetId
    )
  }

  function exportReviewReport(versionId: string): { success: boolean; data?: unknown; error?: string } {
    const version = reviewVersions.value.find(v => v.id === versionId)
    if (!version) return { success: false, error: '版本不存在' }

    const report = {
      versionInfo: {
        id: version.id,
        versionNumber: version.versionNumber,
        name: version.name,
        description: version.description,
        status: version.status,
        assignee: version.assignee,
        createdAt: version.createdAt,
        updatedAt: version.updatedAt,
        reviewConclusion: version.reviewConclusion,
        reviewedAt: version.reviewedAt,
        reviewedBy: version.reviewedBy
      },
      snapshot: version.snapshot,
      annotations: version.annotations,
      comments: version.comments,
      annotationStats: {
        total: version.annotations.length,
        resolved: version.annotations.filter(a => a.resolved).length,
        unresolved: version.annotations.filter(a => !a.resolved).length
      }
    }

    return { success: true, data: report }
  }

  function exportReviewModuleAsJson() {
    const reviewModule: ReviewModule = {
      versions: JSON.parse(JSON.stringify(reviewVersions.value)),
      currentVersionId: currentReviewVersionId.value,
      activeReviewTab: activeReviewTab.value,
      compareVersionIds: compareVersionIds.value ? [...compareVersionIds.value] as [string, string] : null
    }
    return reviewModule
  }

  function resetToDefault() {
    pauseHistory()
    warpCount.value = 16
    weftCycle.value = 8
    colors.value = JSON.parse(JSON.stringify(DEFAULT_COLORS))
    const defaultLayer = createDefaultLayer(16, 8, '图层 1', 0)
    layers.value = [defaultLayer]
    activeLayerId.value = defaultLayer.id
    grid.value = createEmptyGrid(16, 8)
    currentColorId.value = colors.value[0].id
    schemaName.value = '未命名纹样'
    previewRepeat.value = 6
    clipboard.value = null
    schedulingState.value = defaultSchedulingState()
    processNotes.value = []
    reviewVersions.value = []
    currentReviewVersionId.value = null
    activeReviewTab.value = 'versions'
    compareVersionIds.value = null
    resumeHistory()
    initHistory()
  }

  initHistory()

  return {
    warpCount,
    weftCycle,
    colors,
    grid,
    currentColorId,
    previewRepeat,
    schemaName,
    layers,
    activeLayerId,
    activeLayer,
    sortedLayers,
    composedGrid,
    currentColor,
    consumptionStats,
    layerConsumptions,
    totalCells,
    filledCells,
    processSheet,
    schedulingSteps,
    schedulingData,
    schedulingState,
    processNotes,
    canUndo,
    canRedo,
    clipboard,
    setWarpCount,
    setWeftCycle,
    setCurrentColor,
    setCell,
    clearGrid,
    fillGrid,
    addColor,
    removeColor,
    updateColor,
    setPreviewRepeat,
    setSchemaName,
    setActiveLayer,
    addLayer,
    removeLayer,
    duplicateLayer,
    renameLayer,
    toggleLayerVisibility,
    toggleLayerLock,
    setLayerOpacity,
    moveLayerUp,
    moveLayerDown,
    mirrorCurrentLayerHorizontal,
    mirrorCurrentLayerVertical,
    shiftCurrentLayerHorizontal,
    shiftCurrentLayerVertical,
    copySelection,
    pasteSelection,
    hasClipboardData,
    setSchedulingRepeatCount,
    setSchedulingFilterColor,
    setCurrentSchedulingStep,
    toggleStepCompleted,
    markStepCompleted,
    markStepIncomplete,
    goToNextStep,
    goToPrevStep,
    resetSchedulingProgress,
    exportSchedulingJson,
    setProcessNotes,
    addProcessNote,
    removeProcessNote,
    updateProcessNote,
    reviewVersions,
    currentReviewVersionId,
    currentReviewVersion,
    sortedReviewVersions,
    activeReviewTab,
    compareVersionIds,
    reviewComparisonResult,
    createSampleVersion,
    updateSampleVersion,
    deleteSampleVersion,
    setCurrentReviewVersion,
    setActiveReviewTab,
    setCompareVersions,
    clearCompareVersions,
    compareSampleVersions,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    resolveAnnotation,
    unresolveAnnotation,
    getAnnotationsForTarget,
    addReviewComment,
    updateReviewStatus,
    updateReviewConclusion,
    exportReviewReport,
    exportReviewModuleAsJson,
    saveHistory,
    pauseHistory,
    resumeHistory,
    exportSchema,
    importSchema,
    resetToDefault,
    undo,
    redo
  }
})

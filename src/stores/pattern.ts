import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ColorItem, BeatGrid, PatternSchema, ConsumptionItem, LayerItem, LayerConsumption } from '@/types'
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
  generateLayerId
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

  const canUndo = computed(() => historyIndex.value > 0)
  const canRedo = computed(() => historyIndex.value < history.value.length - 1)

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

  function exportSchema() {
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
      updatedAt: new Date().toISOString()
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

    resumeHistory()
    initHistory()

    return { success: true, errors: [] }
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

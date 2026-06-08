import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ColorItem, BeatGrid, PatternSchema, ConsumptionItem } from '@/types'
import { DEFAULT_COLORS, SCHEMA_VERSION } from '@/types'
import {
  createEmptyGrid,
  resizeGrid,
  calculateConsumption,
  downloadJsonFile
} from '@/utils/pattern'
import { validatePatternSchema, generateColorId, validatePositiveInteger } from '@/utils/validator'

const WARP_MIN = 1
const WARP_MAX = 200
const WEFT_MIN = 1
const WEFT_MAX = 100

export const usePatternStore = defineStore('pattern', () => {
  const warpCount = ref(16)
  const weftCycle = ref(8)
  const colors = ref<ColorItem[]>(JSON.parse(JSON.stringify(DEFAULT_COLORS)))
  const grid = ref<BeatGrid>(createEmptyGrid(16, 8))
  const currentColorId = ref(colors.value[0].id)
  const previewRepeat = ref(6)
  const schemaName = ref('未命名纹样')

  const currentColor = computed(() => {
    return colors.value.find(c => c.id === currentColorId.value) || colors.value[0]
  })

  const consumptionStats = computed<ConsumptionItem[]>(() => {
    return calculateConsumption(grid.value, colors.value)
  })

  const totalCells = computed(() => warpCount.value * weftCycle.value)

  const filledCells = computed(() => {
    let count = 0
    grid.value.forEach(row => {
      row.forEach(cell => {
        if (cell !== null) count++
      })
    })
    return count
  })

  function setWarpCount(count: number) {
    if (!validatePositiveInteger(count)) return false
    if (count < WARP_MIN || count > WARP_MAX) return false
    warpCount.value = count
    grid.value = resizeGrid(grid.value, count, weftCycle.value)
    if (!colors.value.find(c => c.id === currentColorId.value)) {
      currentColorId.value = colors.value[0]?.id || ''
    }
    return true
  }

  function setWeftCycle(cycle: number) {
    if (!validatePositiveInteger(cycle)) return false
    if (cycle < WEFT_MIN || cycle > WEFT_MAX) return false
    weftCycle.value = cycle
    grid.value = resizeGrid(grid.value, warpCount.value, cycle)
    return true
  }

  function setCurrentColor(colorId: string) {
    if (colors.value.find(c => c.id === colorId)) {
      currentColorId.value = colorId
    }
  }

  function setCell(row: number, col: number, colorId: string | null) {
    if (
      row >= 0 &&
      row < weftCycle.value &&
      col >= 0 &&
      col < warpCount.value
    ) {
      if (colorId === null || colors.value.find(c => c.id === colorId)) {
        grid.value[row][col] = colorId
      }
    }
  }

  function clearGrid() {
    grid.value = createEmptyGrid(warpCount.value, weftCycle.value)
  }

  function fillGrid(colorId: string) {
    if (!colors.value.find(c => c.id === colorId)) return
    grid.value = grid.value.map(row => row.map(() => colorId))
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
    grid.value = grid.value.map(row =>
      row.map(cell => (cell === colorId ? null : cell))
    )

    if (currentColorId.value === colorId) {
      currentColorId.value = colors.value[0]?.id || ''
    }

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

  function exportSchema() {
    const schema: PatternSchema = {
      version: SCHEMA_VERSION,
      name: schemaName.value,
      warpCount: warpCount.value,
      weftCycle: weftCycle.value,
      colors: JSON.parse(JSON.stringify(colors.value)),
      grid: JSON.parse(JSON.stringify(grid.value)),
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

    warpCount.value = schema.warpCount
    weftCycle.value = schema.weftCycle
    colors.value = JSON.parse(JSON.stringify(schema.colors))
    grid.value = JSON.parse(JSON.stringify(schema.grid))
    schemaName.value = schema.name
    currentColorId.value = colors.value[0]?.id || ''

    return { success: true, errors: [] }
  }

  function resetToDefault() {
    warpCount.value = 16
    weftCycle.value = 8
    colors.value = JSON.parse(JSON.stringify(DEFAULT_COLORS))
    grid.value = createEmptyGrid(16, 8)
    currentColorId.value = colors.value[0].id
    schemaName.value = '未命名纹样'
    previewRepeat.value = 6
  }

  return {
    warpCount,
    weftCycle,
    colors,
    grid,
    currentColorId,
    previewRepeat,
    schemaName,
    currentColor,
    consumptionStats,
    totalCells,
    filledCells,
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
    exportSchema,
    importSchema,
    resetToDefault
  }
})

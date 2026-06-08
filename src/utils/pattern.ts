import type {
  BeatGrid,
  ColorItem,
  ConsumptionItem,
  LayerItem,
  LayerConsumption,
  LayerProcessInfo,
  ProcessSheetData,
  SchedulingStep,
  SchedulingData,
  SchedulingState
} from '@/types'

export function createEmptyGrid(warpCount: number, weftCycle: number): BeatGrid {
  const grid: BeatGrid = []
  for (let i = 0; i < weftCycle; i++) {
    grid.push(new Array(warpCount).fill(null))
  }
  return grid
}

export function resizeGrid(
  oldGrid: BeatGrid,
  newWarpCount: number,
  newWeftCycle: number,
  fillValue: string | null = null
): BeatGrid {
  const newGrid: BeatGrid = []

  for (let row = 0; row < newWeftCycle; row++) {
    const newRow: (string | null)[] = []
    for (let col = 0; col < newWarpCount; col++) {
      if (row < oldGrid.length && col < oldGrid[row].length) {
        newRow.push(oldGrid[row][col])
      } else {
        newRow.push(fillValue)
      }
    }
    newGrid.push(newRow)
  }

  return newGrid
}

export function calculateConsumption(
  grid: BeatGrid,
  colors: ColorItem[]
): ConsumptionItem[] {
  const countMap = new Map<string, number>()
  let totalCount = 0

  const colorMap = new Map<string, ColorItem>()
  colors.forEach(c => {
    colorMap.set(c.id, c)
    countMap.set(c.id, 0)
  })

  grid.forEach(row => {
    row.forEach(cell => {
      if (cell !== null && countMap.has(cell)) {
        countMap.set(cell, countMap.get(cell)! + 1)
        totalCount++
      }
    })
  })

  const result: ConsumptionItem[] = []
  colors.forEach(color => {
    const count = countMap.get(color.id) || 0
    result.push({
      colorId: color.id,
      colorName: color.name,
      colorValue: color.value,
      count,
      percentage: totalCount > 0 ? count / totalCount : 0
    })
  })

  return result
}

export function calculateTotalConsumption(
  layers: LayerItem[],
  colors: ColorItem[]
): ConsumptionItem[] {
  const countMap = new Map<string, number>()
  let totalCount = 0

  const colorMap = new Map<string, ColorItem>()
  colors.forEach(c => {
    colorMap.set(c.id, c)
    countMap.set(c.id, 0)
  })

  const visibleLayers = layers.filter(l => l.visible).sort((a, b) => a.order - b.order)
  
  const warpCount = layers[0]?.grid[0]?.length || 0
  const weftCycle = layers[0]?.grid.length || 0
  const composedGrid = composeLayers(layers, warpCount, weftCycle)

  composedGrid.forEach(row => {
    row.forEach(cell => {
      if (cell !== null && countMap.has(cell)) {
        countMap.set(cell, countMap.get(cell)! + 1)
        totalCount++
      }
    })
  })

  const result: ConsumptionItem[] = []
  colors.forEach(color => {
    const count = countMap.get(color.id) || 0
    result.push({
      colorId: color.id,
      colorName: color.name,
      colorValue: color.value,
      count,
      percentage: totalCount > 0 ? count / totalCount : 0
    })
  })

  return result
}

export function composeLayers(
  layers: LayerItem[],
  warpCount: number,
  weftCycle: number
): BeatGrid {
  const result: BeatGrid = createEmptyGrid(warpCount, weftCycle)
  const sortedLayers = [...layers].filter(l => l.visible).sort((a, b) => a.order - b.order)

  for (let row = 0; row < weftCycle; row++) {
    for (let col = 0; col < warpCount; col++) {
      for (const layer of sortedLayers) {
        if (layer.grid[row]?.[col] !== null) {
          result[row][col] = layer.grid[row][col]
          break
        }
      }
    }
  }

  return result
}

export function generatePreviewGrid(
  grid: BeatGrid,
  repeatCount: number
): BeatGrid {
  const preview: BeatGrid = []
  for (let i = 0; i < repeatCount; i++) {
    preview.push(...grid.map(row => [...row]))
  }
  return preview
}

export function mirrorHorizontal(grid: BeatGrid): BeatGrid {
  return grid.map(row => [...row].reverse())
}

export function mirrorVertical(grid: BeatGrid): BeatGrid {
  return [...grid].reverse()
}

export function shiftHorizontal(grid: BeatGrid, offset: number): BeatGrid {
  const cols = grid[0]?.length || 0
  if (cols === 0) return grid
  const normalizedOffset = ((offset % cols) + cols) % cols
  return grid.map(row => {
    const newRow = [...row]
    return [...newRow.slice(-normalizedOffset), ...newRow.slice(0, -normalizedOffset)]
  })
}

export function shiftVertical(grid: BeatGrid, offset: number): BeatGrid {
  const rows = grid.length
  if (rows === 0) return grid
  const normalizedOffset = ((offset % rows) + rows) % rows
  return [...grid.slice(-normalizedOffset), ...grid.slice(0, -normalizedOffset)]
}

export function copyRegion(
  grid: BeatGrid,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number
): BeatGrid {
  const minRow = Math.max(0, Math.min(startRow, endRow))
  const maxRow = Math.min(grid.length - 1, Math.max(startRow, endRow))
  const minCol = Math.max(0, Math.min(startCol, endCol))
  const maxCol = Math.min(grid[0]?.length - 1 || 0, Math.max(startCol, endCol))

  const region: BeatGrid = []
  for (let r = minRow; r <= maxRow; r++) {
    region.push(grid[r].slice(minCol, maxCol + 1))
  }
  return region
}

export function pasteRegion(
  targetGrid: BeatGrid,
  sourceRegion: BeatGrid,
  targetRow: number,
  targetCol: number,
  mode: 'replace' | 'overwrite' = 'overwrite'
): BeatGrid {
  const result = targetGrid.map(row => [...row])
  const sourceRows = sourceRegion.length
  const sourceCols = sourceRegion[0]?.length || 0
  const targetRows = result.length
  const targetCols = result[0]?.length || 0

  for (let r = 0; r < sourceRows; r++) {
    const targetR = targetRow + r
    if (targetR < 0 || targetR >= targetRows) continue
    for (let c = 0; c < sourceCols; c++) {
      const targetC = targetCol + c
      if (targetC < 0 || targetC >= targetCols) continue
      if (mode === 'overwrite' || sourceRegion[r][c] !== null) {
        result[targetR][targetC] = sourceRegion[r][c]
      }
    }
  }
  return result
}

export function generateLayerId(): string {
  return `layer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function createDefaultLayer(
  warpCount: number,
  weftCycle: number,
  name: string = '图层 1',
  order: number = 0
): LayerItem {
  return {
    id: generateLayerId(),
    name,
    visible: true,
    locked: false,
    opacity: 100,
    order,
    grid: createEmptyGrid(warpCount, weftCycle)
  }
}

export function cloneGrid(grid: BeatGrid): BeatGrid {
  return grid.map(row => [...row])
}

export function cloneLayer(layer: LayerItem): LayerItem {
  return {
    ...layer,
    grid: cloneGrid(layer.grid)
  }
}

export function downloadJsonFile(data: unknown, filename: string): void {
  const jsonStr = JSON.stringify(data, null, 2)
  const blob = new Blob([jsonStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function readJsonFile(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const content = e.target?.result as string
        const data = JSON.parse(content)
        resolve(data)
      } catch (err) {
        reject(new Error('文件解析失败，请确保是有效的 JSON 文件'))
      }
    }
    reader.onerror = () => {
      reject(new Error('文件读取失败'))
    }
    reader.readAsText(file)
  })
}

export function calculateLayerProcessInfo(
  layers: LayerItem[],
  warpCount: number,
  weftCycle: number
): LayerProcessInfo[] {
  const sortedLayers = [...layers].sort((a, b) => a.order - b.order)

  return sortedLayers.map(layer => {
    let cellCount = 0
    layer.grid.forEach(row => {
      row.forEach(cell => {
        if (cell !== null) cellCount++
      })
    })

    return {
      layerId: layer.id,
      layerName: layer.name,
      description: layer.visible ? '可见图层' : '隐藏图层',
      cellCount
    }
  })
}

export function getUsedColors(
  grid: BeatGrid,
  colors: ColorItem[]
): ColorItem[] {
  const usedColorIds = new Set<string>()
  grid.forEach(row => {
    row.forEach(cell => {
      if (cell !== null) usedColorIds.add(cell)
    })
  })
  return colors.filter(c => usedColorIds.has(c.id))
}

export function calculateSuggestedRepeats(
  warpCount: number,
  weftCycle: number,
  filledCells: number
): number {
  if (filledCells === 0) return 1
  const baseRepeats = Math.ceil(100 / weftCycle)
  return Math.max(1, Math.min(50, baseRepeats))
}

export function generateOperationNotes(
  warpCount: number,
  weftCycle: number,
  colorCount: number,
  layerCount: number
): string[] {
  const notes: string[] = []

  notes.push(`经线数量为 ${warpCount} 根，请根据设计调整经线张力。`)
  notes.push(`纬线循环周期为 ${weftCycle} 行，完整纹样重复 ${weftCycle} 行后回到起始位置。`)

  if (colorCount > 3) {
    notes.push(`共使用 ${colorCount} 种颜色，建议提前按顺序备好线轴。`)
  }

  if (layerCount > 1) {
    notes.push(`纹样包含 ${layerCount} 个图层，请注意叠层顺序和遮挡关系。`)
  }

  notes.push('编织时请保持均匀力度，避免线材松紧不一。')
  notes.push('建议先编织小样验证效果，再进行大批量生产。')

  return notes
}

export function generateProcessSheet(
  name: string,
  warpCount: number,
  weftCycle: number,
  colors: ColorItem[],
  layers: LayerItem[],
  composedGrid: BeatGrid,
  totalConsumption: ConsumptionItem[],
  layerConsumptions: LayerConsumption[]
): ProcessSheetData {
  const totalCells = warpCount * weftCycle
  let filledCells = 0
  composedGrid.forEach(row => {
    row.forEach(cell => {
      if (cell !== null) filledCells++
    })
  })

  const usedColors = getUsedColors(composedGrid, colors)
  const layerInfos = calculateLayerProcessInfo(layers, warpCount, weftCycle)
  const suggestedRepeats = calculateSuggestedRepeats(warpCount, weftCycle, filledCells)
  const operationNotes = generateOperationNotes(warpCount, weftCycle, usedColors.length, layers.length)

  return {
    name,
    warpCount,
    weftCycle,
    totalCells,
    filledCells,
    fillRate: totalCells > 0 ? filledCells / totalCells : 0,
    colors: [...colors],
    usedColors,
    layers: layerInfos,
    totalConsumption,
    layerConsumptions,
    suggestedRepeats,
    totalWarpBeats: warpCount,
    totalWeftBeats: weftCycle * suggestedRepeats,
    operationNotes,
    createdAt: new Date().toISOString()
  }
}

export function generateSchedulingSteps(
  composedGrid: BeatGrid,
  colors: ColorItem[],
  repeatCount: number
): SchedulingStep[] {
  const steps: SchedulingStep[] = []
  const weftCycle = composedGrid.length
  const warpCount = composedGrid[0]?.length || 0
  const colorMap = new Map<string, ColorItem>()
  colors.forEach(c => colorMap.set(c.id, c))

  let stepIndex = 0

  for (let repeat = 0; repeat < repeatCount; repeat++) {
    for (let beat = 0; beat < weftCycle; beat++) {
      const row = composedGrid[beat]
      const colorPositions = new Map<string, number[]>()

      for (let col = 0; col < warpCount; col++) {
        const colorId = row[col]
        if (colorId !== null) {
          if (!colorPositions.has(colorId)) {
            colorPositions.set(colorId, [])
          }
          colorPositions.get(colorId)!.push(col + 1)
        }
      }

      for (const [colorId, positions] of colorPositions) {
        const color = colorMap.get(colorId)
        if (!color) continue

        const description = `第 ${repeat + 1} 轮 · 第 ${beat + 1} 排 · ${color.name} · 共 ${positions.length} 根经线`

        steps.push({
          id: `step-${repeat}-${beat}-${colorId}`,
          stepIndex,
          beatIndex: beat,
          repeatIndex: repeat,
          colorId,
          colorName: color.name,
          colorValue: color.value,
          description,
          warpPositions: positions,
          completed: false
        })
        stepIndex++
      }
    }
  }

  return steps
}

export function buildSchedulingData(
  steps: SchedulingStep[],
  state: SchedulingState
): SchedulingData {
  const completedSet = new Set(state.completedStepIds)
  const stepsWithStatus = steps.map(step => ({
    ...step,
    completed: completedSet.has(step.id)
  }))

  const filteredSteps = state.filterColorId
    ? stepsWithStatus.filter(s => s.colorId === state.filterColorId)
    : stepsWithStatus

  const currentStepIndex = state.currentStepId
    ? Math.max(0, filteredSteps.findIndex(s => s.id === state.currentStepId))
    : 0

  const completedCount = stepsWithStatus.filter(s => s.completed).length

  return {
    steps: filteredSteps,
    currentStepIndex,
    filterColorId: state.filterColorId,
    repeatCount: state.repeatCount,
    completedCount,
    totalCount: steps.length
  }
}

export function exportSchedulingAsJson(
  steps: SchedulingStep[],
  processSheet: ProcessSheetData
): void {
  const data = {
    processSheet,
    scheduling: {
      repeatCount: Math.ceil(steps.length / (processSheet.weftCycle * Math.max(1, processSheet.usedColors.length))),
      totalSteps: steps.length,
      steps
    }
  }
  const filename = `排线方案-${processSheet.name}-${Date.now()}.json`
  downloadJsonFile(data, filename)
}

export function defaultSchedulingState(): SchedulingState {
  return {
    completedStepIds: [],
    currentStepId: null,
    filterColorId: null,
    repeatCount: 6
  }
}

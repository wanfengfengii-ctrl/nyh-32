import type { BeatGrid, ColorItem, ConsumptionItem, LayerItem } from '@/types'

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

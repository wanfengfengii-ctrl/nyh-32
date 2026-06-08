import type { BeatGrid, ColorItem, ConsumptionItem } from '@/types'

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

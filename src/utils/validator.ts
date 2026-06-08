import type { PatternSchema, ValidationResult, ColorItem, BeatGrid } from '@/types'

const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/

export function validateHexColor(value: string): boolean {
  return HEX_COLOR_REGEX.test(value)
}

export function validatePositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0
}

export function validateColors(colors: ColorItem[]): string[] {
  const errors: string[] = []

  if (!Array.isArray(colors) || colors.length < 2) {
    errors.push('颜色方案至少需要 2 种颜色')
    return errors
  }

  const idSet = new Set<string>()
  colors.forEach((color, index) => {
    if (!color.id || typeof color.id !== 'string') {
      errors.push(`第 ${index + 1} 个颜色缺少有效的 id`)
    } else if (idSet.has(color.id)) {
      errors.push(`存在重复的颜色编号: ${color.id}`)
    } else {
      idSet.add(color.id)
    }

    if (!color.name || typeof color.name !== 'string') {
      errors.push(`第 ${index + 1} 个颜色缺少名称`)
    }

    if (!color.value || typeof color.value !== 'string' || !validateHexColor(color.value)) {
      errors.push(`第 ${index + 1} 个颜色存在无效的颜色值`)
    }
  })

  return errors
}

export function validateGrid(
  grid: BeatGrid,
  warpCount: number,
  weftCycle: number,
  colors: ColorItem[]
): string[] {
  const errors: string[] = []

  if (!Array.isArray(grid)) {
    errors.push('网格数据格式无效')
    return errors
  }

  if (grid.length !== weftCycle) {
    errors.push(`网格行数 (${grid.length}) 与纬线周期 (${weftCycle}) 不匹配`)
  }

  const colorIds = new Set(colors.map(c => c.id))

  grid.forEach((row, rowIndex) => {
    if (!Array.isArray(row)) {
      errors.push(`第 ${rowIndex + 1} 行数据格式无效`)
      return
    }

    if (row.length !== warpCount) {
      errors.push(`第 ${rowIndex + 1} 行列数 (${row.length}) 与经线数量 (${warpCount}) 不匹配`)
    }

    row.forEach((cell, colIndex) => {
      if (cell !== null && typeof cell !== 'string') {
        errors.push(`第 ${rowIndex + 1} 行第 ${colIndex + 1} 列数据类型无效`)
      } else if (cell !== null && !colorIds.has(cell)) {
        errors.push(`第 ${rowIndex + 1} 行第 ${colIndex + 1} 列存在无效的颜色编号: ${cell}`)
      }
    })
  })

  return errors
}

export function validatePatternSchema(schema: unknown): ValidationResult {
  const errors: string[] = []

  if (!schema || typeof schema !== 'object') {
    return { valid: false, errors: ['方案数据格式无效'] }
  }

  const data = schema as Record<string, unknown>

  if (!data.version || typeof data.version !== 'string') {
    errors.push('缺少有效的版本号')
  }

  if (!data.name || typeof data.name !== 'string') {
    errors.push('缺少方案名称')
  }

  const warpCount = data.warpCount
  if (typeof warpCount !== 'number' || !validatePositiveInteger(warpCount)) {
    errors.push('经线数量无效，必须为大于 0 的整数')
  }

  const weftCycle = data.weftCycle
  if (typeof weftCycle !== 'number' || !validatePositiveInteger(weftCycle)) {
    errors.push('纬线循环周期无效，必须为大于 0 的整数')
  }

  const colors = data.colors as ColorItem[]
  const colorErrors = validateColors(colors)
  errors.push(...colorErrors)

  if (errors.length === 0) {
    const grid = data.grid as BeatGrid
    const gridErrors = validateGrid(grid, warpCount as number, weftCycle as number, colors)
    errors.push(...gridErrors)
  }

  return { valid: errors.length === 0, errors }
}

export function generateColorId(): string {
  return `color-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

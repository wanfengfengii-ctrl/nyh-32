import type {
  PatternSchema,
  ValidationResult,
  ColorItem,
  BeatGrid,
  LayerItem,
  ProcessSchedulingModule,
  SchedulingState
} from '@/types'

const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/

export function validateHexColor(value: string): boolean {
  return HEX_COLOR_REGEX.test(value)
}

export function validatePositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0
}

export function validateOpacity(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 100
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

export function validateLayers(
  layers: LayerItem[],
  warpCount: number,
  weftCycle: number,
  colors: ColorItem[]
): string[] {
  const errors: string[] = []

  if (!Array.isArray(layers) || layers.length === 0) {
    errors.push('图层数据无效，至少需要一个图层')
    return errors
  }

  const idSet = new Set<string>()
  const orderSet = new Set<number>()

  layers.forEach((layer, index) => {
    const prefix = `第 ${index + 1} 个图层`

    if (!layer.id || typeof layer.id !== 'string') {
      errors.push(`${prefix}缺少有效的 id`)
    } else if (idSet.has(layer.id)) {
      errors.push(`存在重复的图层编号: ${layer.id}`)
    } else {
      idSet.add(layer.id)
    }

    if (!layer.name || typeof layer.name !== 'string') {
      errors.push(`${prefix}缺少名称`)
    }

    if (typeof layer.visible !== 'boolean') {
      errors.push(`${prefix}的 visible 字段无效`)
    }

    if (typeof layer.locked !== 'boolean') {
      errors.push(`${prefix}的 locked 字段无效`)
    }

    if (!validateOpacity(layer.opacity)) {
      errors.push(`${prefix}的透明度无效，必须在 0-100 之间`)
    }

    if (typeof layer.order !== 'number' || !Number.isInteger(layer.order)) {
      errors.push(`${prefix}的顺序字段无效`)
    } else if (orderSet.has(layer.order)) {
      errors.push(`存在重复的图层顺序值: ${layer.order}`)
    } else {
      orderSet.add(layer.order)
    }

    if (!layer.grid) {
      errors.push(`${prefix}缺少网格数据`)
    } else {
      const gridErrors = validateGrid(layer.grid, warpCount, weftCycle, colors)
      gridErrors.forEach(err => errors.push(`${prefix} - ${err}`))
    }
  })

  return errors
}

export function validateSchedulingState(
  state: unknown,
  colors: ColorItem[]
): string[] {
  const errors: string[] = []

  if (!state || typeof state !== 'object') {
    errors.push('排程状态数据格式无效')
    return errors
  }

  const s = state as Record<string, unknown>

  if (!Array.isArray(s.completedStepIds)) {
    errors.push('排程已完成步骤列表格式无效')
  } else {
    s.completedStepIds.forEach((id: unknown, index: number) => {
      if (typeof id !== 'string') {
        errors.push(`第 ${index + 1} 个已完成步骤 ID 格式无效`)
      }
    })
  }

  if (s.currentStepId !== undefined && s.currentStepId !== null && typeof s.currentStepId !== 'string') {
    errors.push('当前步骤 ID 格式无效')
  }

  if (s.filterColorId !== undefined && s.filterColorId !== null) {
    if (typeof s.filterColorId !== 'string') {
      errors.push('筛选颜色 ID 格式无效')
    } else if (!colors.find(c => c.id === s.filterColorId)) {
      // Valid color ID exists in colors list - this is okay
    }
  }

  if (s.repeatCount !== undefined) {
    if (typeof s.repeatCount !== 'number' || !validatePositiveInteger(s.repeatCount) || s.repeatCount < 1 || s.repeatCount > 100) {
      errors.push('重复次数无效，必须为 1-100 之间的整数')
    }
  }

  return errors
}

export function validateProcessSchedulingModule(
  module: unknown,
  colors: ColorItem[]
): string[] {
  const errors: string[] = []

  if (!module || typeof module !== 'object') {
    errors.push('工艺排线模块数据格式无效')
    return errors
  }

  const m = module as Record<string, unknown>

  if (m.scheduling !== undefined) {
    const schedulingErrors = validateSchedulingState(m.scheduling, colors)
    schedulingErrors.forEach(err => errors.push(`排程模块 - ${err}`))
  }

  if (m.notes !== undefined) {
    if (!Array.isArray(m.notes)) {
      errors.push('备注列表格式无效')
    } else {
      m.notes.forEach((note: unknown, index: number) => {
        if (typeof note !== 'string') {
          errors.push(`第 ${index + 1} 条备注格式无效`)
        }
      })
    }
  }

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

  if (data.layers !== undefined) {
    if (errors.length === 0) {
      const layers = data.layers as LayerItem[]
      const layerErrors = validateLayers(layers, warpCount as number, weftCycle as number, colors)
      errors.push(...layerErrors)
    }

    if (data.activeLayerId === undefined || typeof data.activeLayerId !== 'string') {
      errors.push('缺少有效的当前图层 ID')
    }
  }

  if (data.processScheduling !== undefined && errors.length === 0) {
    const psErrors = validateProcessSchedulingModule(data.processScheduling, colors)
    errors.push(...psErrors)
  }

  return { valid: errors.length === 0, errors }
}

export function generateColorId(): string {
  return `color-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

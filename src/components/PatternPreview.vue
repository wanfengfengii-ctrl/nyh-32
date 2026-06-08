<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { usePatternStore } from '@/stores/pattern'
import { storeToRefs } from 'pinia'
import { generatePreviewGrid } from '@/utils/pattern'

const store = usePatternStore()
const { composedGrid, colors, warpCount, weftCycle, previewRepeat, sortedLayers } = storeToRefs(store)

const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const cellSize = ref(10)

const previewGrid = computed(() => {
  return generatePreviewGrid(composedGrid.value, previewRepeat.value)
})

const colorMap = computed(() => {
  const map = new Map<string, string>()
  colors.value.forEach(c => map.set(c.id, c.value))
  return map
})

const totalRows = computed(() => weftCycle.value * previewRepeat.value)

const visibleLayerCount = computed(() => sortedLayers.value.filter(l => l.visible).length)

function renderCanvas() {
  const canvas = canvasRef.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const width = warpCount.value * cellSize.value
  const height = totalRows.value * cellSize.value

  const dpr = window.devicePixelRatio || 1
  canvas.width = width * dpr
  canvas.height = height * dpr
  canvas.style.width = width + 'px'
  canvas.style.height = height + 'px'
  ctx.scale(dpr, dpr)

  ctx.clearRect(0, 0, width, height)

  const pg = previewGrid.value
  for (let row = 0; row < pg.length; row++) {
    for (let col = 0; col < pg[row].length; col++) {
      const cell = pg[row][col]
      if (cell !== null) {
        const color = colorMap.value.get(cell)
        if (color) {
          ctx.fillStyle = color
          ctx.fillRect(col * cellSize.value, row * cellSize.value, cellSize.value, cellSize.value)
        }
      } else {
        ctx.fillStyle = '#f8f5f0'
        ctx.fillRect(col * cellSize.value, row * cellSize.value, cellSize.value, cellSize.value)
      }
    }
  }

  ctx.strokeStyle = 'rgba(212, 200, 184, 0.5)'
  ctx.lineWidth = 0.5
  for (let i = 0; i <= warpCount.value; i++) {
    ctx.beginPath()
    ctx.moveTo(i * cellSize.value, 0)
    ctx.lineTo(i * cellSize.value, height)
    ctx.stroke()
  }
  for (let i = 0; i <= totalRows.value; i++) {
    ctx.beginPath()
    ctx.moveTo(0, i * cellSize.value)
    ctx.lineTo(width, i * cellSize.value)
    ctx.stroke()
  }

  ctx.strokeStyle = '#c84b31'
  ctx.lineWidth = 1.5
  ctx.setLineDash([4, 3])
  for (let i = 1; i < previewRepeat.value; i++) {
    const y = i * weftCycle.value * cellSize.value
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }
  ctx.setLineDash([])
}

function zoomIn() {
  cellSize.value = Math.min(30, cellSize.value + 2)
  nextTick(renderCanvas)
}

function zoomOut() {
  cellSize.value = Math.max(4, cellSize.value - 2)
  nextTick(renderCanvas)
}

function handleRepeatChange(value: number) {
  store.setPreviewRepeat(value)
}

watch(
  [composedGrid, colors, previewRepeat, warpCount, weftCycle],
  () => {
    nextTick(renderCanvas)
  },
  { deep: true }
)

onMounted(() => {
  nextTick(renderCanvas)
})
</script>

<template>
  <div class="pattern-preview">
    <div class="preview-header">
      <span class="title">纹样预览</span>
      <div class="preview-controls">
        <div class="repeat-control">
          <span class="label">重复</span>
          <button
            class="ctrl-btn"
            :disabled="previewRepeat <= 1"
            @click="handleRepeatChange(previewRepeat - 1)"
          >
            −
          </button>
          <span class="repeat-num">{{ previewRepeat }}</span>
          <button
            class="ctrl-btn"
            :disabled="previewRepeat >= 50"
            @click="handleRepeatChange(previewRepeat + 1)"
          >
            +
          </button>
        </div>
        <div class="zoom-control">
          <button class="ctrl-btn" @click="zoomOut" title="缩小">−</button>
          <button class="ctrl-btn" @click="zoomIn" title="放大">+</button>
        </div>
      </div>
    </div>

    <div class="preview-container" ref="containerRef">
      <div class="canvas-wrapper">
        <canvas ref="canvasRef" class="preview-canvas"></canvas>
      </div>
    </div>

    <div class="preview-info">
      <span class="info-item">
        <span class="info-label">经线：</span>
        <span class="info-value">{{ warpCount }} 根</span>
      </span>
      <span class="info-divider">|</span>
      <span class="info-item">
        <span class="info-label">纬线：</span>
        <span class="info-value">{{ weftCycle }} × {{ previewRepeat }} = {{ totalRows }} 行</span>
      </span>
      <span class="info-divider">|</span>
      <span class="info-item">
        <span class="info-label">可见图层：</span>
        <span class="info-value">{{ visibleLayerCount }}</span>
      </span>
    </div>

    <div class="legend">
      <div class="legend-item">
        <div class="legend-line cycle-line"></div>
        <span class="legend-text">循环分隔线</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.pattern-preview {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(61, 44, 30, 0.08);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .title {
    font-size: 18px;
    font-weight: 600;
    color: #3d2c1e;
  }

  .preview-controls {
    display: flex;
    gap: 16px;
    align-items: center;
  }

  .repeat-control,
  .zoom-control {
    display: flex;
    align-items: center;
    gap: 6px;
    background: #f8f5f0;
    padding: 4px 8px;
    border-radius: 8px;

    .label {
      font-size: 12px;
      color: #8b7355;
    }

    .ctrl-btn {
      width: 24px;
      height: 24px;
      border: none;
      background: transparent;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      color: #6b5b47;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;

      &:hover:not(:disabled) {
        background: #e8e0d5;
      }

      &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
    }

    .repeat-num {
      font-size: 13px;
      font-weight: 600;
      color: #3d2c1e;
      min-width: 24px;
      text-align: center;
    }
  }
}

.preview-container {
  overflow: auto;
  max-height: 320px;
  border: 1px solid #e8e0d5;
  border-radius: 8px;
  background: #faf7f2;
  padding: 16px;
}

.canvas-wrapper {
  display: inline-block;
  position: relative;
}

.preview-canvas {
  display: block;
  image-rendering: pixelated;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.preview-info {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: #6b5b47;
  flex-wrap: wrap;

  .info-item {
    .info-label {
      color: #8b7355;
    }

    .info-value {
      font-weight: 600;
      color: #3d2c1e;
    }
  }

  .info-divider {
    color: #d4c8b8;
  }
}

.legend {
  display: flex;
  gap: 16px;
  padding-top: 8px;
  border-top: 1px dashed #e8e0d5;

  .legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .legend-line {
    width: 24px;
    height: 0;
    border-top: 2px dashed #c84b31;
  }

  .cycle-line {
    border-style: dashed;
  }

  .legend-text {
    font-size: 12px;
    color: #8b7355;
  }
}
</style>

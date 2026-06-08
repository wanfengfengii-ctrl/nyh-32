<script setup lang="ts">
import { ref, computed } from 'vue'
import { usePatternStore } from '@/stores/pattern'
import { storeToRefs } from 'pinia'

const store = usePatternStore()
const { grid, colors, currentColor, warpCount, weftCycle, currentColorId } = storeToRefs(store)

const isDrawing = ref(false)
const drawMode = ref<'paint' | 'erase'>('paint')
const cellSize = ref(28)
const isSelecting = ref(false)
const selectionStart = ref<{ row: number; col: number } | null>(null)
const selectionEnd = ref<{ row: number; col: number } | null>(null)

const colorMap = computed(() => {
  const map = new Map<string, string>()
  colors.value.forEach(c => map.set(c.id, c.value))
  return map
})

const selectionRect = computed(() => {
  if (!selectionStart.value || !selectionEnd.value) return null
  const startRow = Math.min(selectionStart.value.row, selectionEnd.value.row)
  const endRow = Math.max(selectionStart.value.row, selectionEnd.value.row)
  const startCol = Math.min(selectionStart.value.col, selectionEnd.value.col)
  const endCol = Math.max(selectionStart.value.col, selectionEnd.value.col)
  return { startRow, endRow, startCol, endCol }
})

function getCellColor(cellValue: string | null): string {
  if (cellValue === null) return 'transparent'
  return colorMap.value.get(cellValue) || 'transparent'
}

function handleMouseDown(row: number, col: number, event: MouseEvent) {
  event.preventDefault()
  if (event.button === 2) {
    isDrawing.value = true
    drawMode.value = 'erase'
    store.setCell(row, col, null)
    return
  }

  if (event.shiftKey) {
    isSelecting.value = true
    selectionStart.value = { row, col }
    selectionEnd.value = { row, col }
    return
  }

  isDrawing.value = true
  drawMode.value = 'paint'
  store.setCell(row, col, currentColorId.value)
}

function handleMouseEnter(row: number, col: number) {
  if (isSelecting.value) {
    selectionEnd.value = { row, col }
    return
  }

  if (!isDrawing.value) return
  if (drawMode.value === 'paint') {
    store.setCell(row, col, currentColorId.value)
  } else {
    store.setCell(row, col, null)
  }
}

function handleMouseUp() {
  if (isSelecting.value && selectionRect.value) {
    fillSelection()
  }
  isDrawing.value = false
  isSelecting.value = false
  selectionStart.value = null
  selectionEnd.value = null
}

function handleContextMenu(e: MouseEvent) {
  e.preventDefault()
}

function isInSelection(row: number, col: number): boolean {
  if (!selectionRect.value) return false
  const { startRow, endRow, startCol, endCol } = selectionRect.value
  return row >= startRow && row <= endRow && col >= startCol && col <= endCol
}

function fillSelection() {
  if (!selectionRect.value) return
  const { startRow, endRow, startCol, endCol } = selectionRect.value
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      store.setCell(r, c, currentColorId.value)
    }
  }
}

function handleClearAll() {
  store.clearGrid()
}

function handleFillAll() {
  store.fillGrid(currentColorId.value)
}

function zoomIn() {
  cellSize.value = Math.min(60, cellSize.value + 4)
}

function zoomOut() {
  cellSize.value = Math.max(12, cellSize.value - 4)
}

function resetZoom() {
  cellSize.value = 28
}
</script>

<template>
  <div class="beat-grid-editor" @mouseup="handleMouseUp" @mouseleave="handleMouseUp">
    <div class="editor-header">
      <div class="editor-title">
        <span class="title-text">节拍网格编辑器</span>
        <span class="grid-info">{{ warpCount }} × {{ weftCycle }}</span>
      </div>
      <div class="editor-tools">
        <div class="zoom-controls">
          <button class="tool-btn" @click="zoomOut" title="缩小">
            <span class="icon">−</span>
          </button>
          <span class="zoom-level">{{ Math.round((cellSize / 28) * 100) }}%</span>
          <button class="tool-btn" @click="zoomIn" title="放大">
            <span class="icon">+</span>
          </button>
          <button class="tool-btn reset-btn" @click="resetZoom" title="重置">
            <span class="icon">⟲</span>
          </button>
        </div>
        <div class="action-buttons">
          <button class="action-btn fill-btn" @click="handleFillAll">全部填充</button>
          <button class="action-btn clear-btn" @click="handleClearAll">全部清空</button>
        </div>
      </div>
    </div>

    <div class="current-color-bar">
      <span class="label">当前颜色：</span>
      <div class="color-preview" :style="{ backgroundColor: currentColor.value }"></div>
      <span class="color-name">{{ currentColor.name }}</span>
      <span class="hint">· 左键绘制 · 右键擦除 · Shift+拖拽框选填充</span>
    </div>

    <div class="grid-container" @contextmenu="handleContextMenu">
      <div class="grid-wrapper">
        <div
          class="beat-grid"
          :style="{
            gridTemplateColumns: `repeat(${warpCount}, ${cellSize}px)`,
            gridTemplateRows: `repeat(${weftCycle}, ${cellSize}px)`
          }"
        >
          <div
            v-for="(row, rowIndex) in grid"
            :key="'row-' + rowIndex"
            class="grid-row"
          >
            <div
              v-for="(cell, colIndex) in row"
              :key="'cell-' + rowIndex + '-' + colIndex"
              class="grid-cell"
              :class="{
                'has-color': cell !== null,
                'in-selection': isInSelection(rowIndex, colIndex)
              }"
              :style="{
                backgroundColor: getCellColor(cell),
                width: cellSize + 'px',
                height: cellSize + 'px'
              }"
              @mousedown="handleMouseDown(rowIndex, colIndex, $event)"
              @mouseenter="handleMouseEnter(rowIndex, colIndex)"
            >
              <div v-if="cell === null" class="empty-cell"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="row-labels">
      <div
        v-for="(_, index) in weftCycle"
        :key="'label-row-' + index"
        class="row-label"
        :style="{ height: cellSize + 'px' }"
      >
        {{ index + 1 }}
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.beat-grid-editor {
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(61, 44, 30, 0.08);
  position: relative;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.editor-title {
  display: flex;
  align-items: center;
  gap: 12px;

  .title-text {
    font-size: 18px;
    font-weight: 600;
    color: #3d2c1e;
  }

  .grid-info {
    font-size: 13px;
    color: #8b7355;
    background: #f5f0e6;
    padding: 4px 10px;
    border-radius: 6px;
    font-weight: 500;
  }
}

.editor-tools {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #f8f5f0;
  padding: 4px;
  border-radius: 8px;

  .tool-btn {
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;

    .icon {
      font-size: 16px;
      color: #6b5b47;
      font-weight: 500;
    }

    &:hover {
      background: #e8e0d5;
    }

    &:active {
      transform: scale(0.95);
    }

    &.reset-btn .icon {
      font-size: 14px;
    }
  }

  .zoom-level {
    font-size: 12px;
    color: #6b5b47;
    min-width: 40px;
    text-align: center;
    font-weight: 500;
  }
}

.action-buttons {
  display: flex;
  gap: 8px;

  .action-btn {
    padding: 8px 16px;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;

    &.fill-btn {
      background: #c84b31;
      color: white;

      &:hover {
        background: #b03d26;
      }
    }

    &.clear-btn {
      background: #f0ebe4;
      color: #6b5b47;

      &:hover {
        background: #e0d8cc;
      }
    }

    &:active {
      transform: scale(0.97);
    }
  }
}

.current-color-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: #faf7f2;
  border-radius: 8px;
  border: 1px dashed #e0d5c5;

  .label {
    font-size: 13px;
    color: #8b7355;
  }

  .color-preview {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    border: 2px solid white;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
  }

  .color-name {
    font-size: 14px;
    font-weight: 600;
    color: #3d2c1e;
  }

  .hint {
    font-size: 12px;
    color: #a08b72;
    margin-left: auto;
  }
}

.grid-container {
  position: relative;
  overflow: auto;
  max-height: 500px;
  border: 1px solid #e8e0d5;
  border-radius: 8px;
  background: repeating-linear-gradient(
    45deg,
    #faf7f2,
    #faf7f2 10px,
    #f5f0e6 10px,
    #f5f0e6 20px
  );
  padding: 16px;
}

.grid-wrapper {
  display: inline-block;
  position: relative;
}

.beat-grid {
  display: grid;
  gap: 1px;
  background: #d4c8b8;
  padding: 1px;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.grid-row {
  display: contents;
}

.grid-cell {
  position: relative;
  cursor: crosshair;
  transition: transform 0.1s ease, box-shadow 0.15s ease;
  background: #fff;

  &:hover {
    z-index: 2;
    box-shadow: 0 0 0 2px #c84b31 inset;
  }

  &.has-color {
    animation: pop-in 0.15s ease-out;
  }

  &.in-selection {
    box-shadow: 0 0 0 2px #3d2c1e inset;
    z-index: 1;
  }

  .empty-cell {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #d4c8b8;
    opacity: 0.5;
  }
}

@keyframes pop-in {
  0% {
    transform: scale(0.8);
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
  }
}

.row-labels {
  display: none;
}
</style>

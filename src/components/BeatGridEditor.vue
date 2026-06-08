<script setup lang="ts">
import { ref, computed } from 'vue'
import { usePatternStore } from '@/stores/pattern'
import { storeToRefs } from 'pinia'
import { useMessage } from 'naive-ui'

const store = usePatternStore()
const message = useMessage()
const { colors, currentColor, warpCount, weftCycle, currentColorId, activeLayer, composedGrid, canUndo, canRedo } = storeToRefs(store)

const isDrawing = ref(false)
const drawMode = ref<'paint' | 'erase'>('paint')
const cellSize = ref(28)
const isSelecting = ref(false)
const selectionStart = ref<{ row: number; col: number } | null>(null)
const selectionEnd = ref<{ row: number; col: number } | null>(null)
const showTransformTools = ref(true)

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

const isLayerLocked = computed(() => activeLayer.value?.locked)

function getCellColor(cellValue: string | null): string {
  if (cellValue === null) return 'transparent'
  return colorMap.value.get(cellValue) || 'transparent'
}

function handleMouseDown(row: number, col: number, event: MouseEvent) {
  if (isLayerLocked.value) {
    message.warning('当前图层已锁定，无法编辑')
    return
  }

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

  if (event.ctrlKey || event.metaKey) {
    if (store.hasClipboardData()) {
      store.pasteSelection(row, col)
      message.success('已粘贴')
    }
    return
  }

  isDrawing.value = true
  drawMode.value = 'paint'
  store.setCell(row, col, currentColorId.value)
}

function handleMouseEnter(row: number, col: number) {
  if (isLayerLocked.value) return

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
  }
  isDrawing.value = false
  isSelecting.value = false
}

function handleMouseLeave() {
  if (isSelecting.value) {
    isSelecting.value = false
    selectionStart.value = null
    selectionEnd.value = null
  }
  isDrawing.value = false
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
  if (!selectionRect.value || isLayerLocked.value) return
  const { startRow, endRow, startCol, endCol } = selectionRect.value
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      store.setCell(r, c, currentColorId.value)
    }
  }
  clearSelection()
  message.success('已填充选区')
}

function clearSelection() {
  selectionStart.value = null
  selectionEnd.value = null
  isSelecting.value = false
}

function handleCopy() {
  if (!selectionRect.value) {
    message.warning('请先框选区域')
    return
  }
  const { startRow, endRow, startCol, endCol } = selectionRect.value
  store.copySelection(startRow, startCol, endRow, endCol)
  clearSelection()
  message.success('已复制选区')
}

function handlePaste() {
  if (!store.hasClipboardData()) {
    message.warning('剪贴板为空')
    return
  }
  if (isLayerLocked.value) {
    message.warning('当前图层已锁定')
    return
  }
  store.pasteSelection(0, 0)
  message.success('已粘贴到左上角')
}

function handleDeleteSelection() {
  if (!selectionRect.value || isLayerLocked.value) return
  const { startRow, endRow, startCol, endCol } = selectionRect.value
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      store.setCell(r, c, null)
    }
  }
  clearSelection()
  message.success('已清除选区')
}

function handleClearAll() {
  if (isLayerLocked.value) {
    message.warning('当前图层已锁定')
    return
  }
  if (confirm('确定要清空当前图层吗？')) {
    store.clearGrid()
    message.success('已清空图层')
  }
}

function handleFillAll() {
  if (isLayerLocked.value) {
    message.warning('当前图层已锁定')
    return
  }
  store.fillGrid(currentColorId.value)
  message.success('已填充图层')
}

function handleMirrorHorizontal() {
  if (isLayerLocked.value) {
    message.warning('当前图层已锁定')
    return
  }
  store.mirrorCurrentLayerHorizontal()
  message.success('横向镜像完成')
}

function handleMirrorVertical() {
  if (isLayerLocked.value) {
    message.warning('当前图层已锁定')
    return
  }
  store.mirrorCurrentLayerVertical()
  message.success('纵向镜像完成')
}

function handleShiftLeft() {
  if (isLayerLocked.value) {
    message.warning('当前图层已锁定')
    return
  }
  store.shiftCurrentLayerHorizontal(-1)
  message.success('左移 1 列')
}

function handleShiftRight() {
  if (isLayerLocked.value) {
    message.warning('当前图层已锁定')
    return
  }
  store.shiftCurrentLayerHorizontal(1)
  message.success('右移 1 列')
}

function handleShiftUp() {
  if (isLayerLocked.value) {
    message.warning('当前图层已锁定')
    return
  }
  store.shiftCurrentLayerVertical(-1)
  message.success('上移 1 行')
}

function handleShiftDown() {
  if (isLayerLocked.value) {
    message.warning('当前图层已锁定')
    return
  }
  store.shiftCurrentLayerVertical(1)
  message.success('下移 1 行')
}

function handleUndo() {
  if (store.undo()) {
    message.success('已撤销')
  } else {
    message.warning('无法撤销')
  }
}

function handleRedo() {
  if (store.redo()) {
    message.success('已重做')
  } else {
    message.warning('无法重做')
  }
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

function toggleTransformTools() {
  showTransformTools.value = !showTransformTools.value
}
</script>

<template>
  <div class="beat-grid-editor" @mouseup="handleMouseUp" @mouseleave="handleMouseLeave">
    <div class="editor-header">
      <div class="editor-title">
        <span class="title-text">节拍网格编辑器</span>
        <span class="grid-info">{{ warpCount }} × {{ weftCycle }}</span>
        <span v-if="activeLayer" class="layer-info">
          当前：{{ activeLayer.name }}
          <span v-if="activeLayer.locked" class="lock-indicator">🔒</span>
        </span>
      </div>
      <div class="editor-tools">
        <div class="history-controls">
          <button class="tool-btn" :disabled="!canUndo" @click="handleUndo" title="撤销 (Ctrl+Z)">
            ↶
          </button>
          <button class="tool-btn" :disabled="!canRedo" @click="handleRedo" title="重做 (Ctrl+Y)">
            ↷
          </button>
        </div>
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
      </div>
    </div>

    <div class="current-color-bar">
      <span class="label">当前颜色：</span>
      <div class="color-preview" :style="{ backgroundColor: currentColor.value }"></div>
      <span class="color-name">{{ currentColor.name }}</span>
      <span class="hint">· 左键绘制 · 右键擦除 · Shift+拖拽框选 · Ctrl+点击粘贴</span>
    </div>

    <div class="transform-bar">
      <div class="transform-section">
        <span class="section-label">镜像</span>
        <div class="transform-buttons">
          <button class="transform-btn" :disabled="isLayerLocked" @click="handleMirrorHorizontal" title="横向镜像">
            ↔ 横向
          </button>
          <button class="transform-btn" :disabled="isLayerLocked" @click="handleMirrorVertical" title="纵向镜像">
            ↕ 纵向
          </button>
        </div>
      </div>

      <div class="transform-section">
        <span class="section-label">循环平移</span>
        <div class="transform-buttons">
          <button class="transform-btn" :disabled="isLayerLocked" @click="handleShiftLeft" title="左移 1 列">
            ← 左移
          </button>
          <button class="transform-btn" :disabled="isLayerLocked" @click="handleShiftRight" title="右移 1 列">
            右移 →
          </button>
          <button class="transform-btn" :disabled="isLayerLocked" @click="handleShiftUp" title="上移 1 行">
            ↑ 上移
          </button>
          <button class="transform-btn" :disabled="isLayerLocked" @click="handleShiftDown" title="下移 1 行">
            下移 ↓
          </button>
        </div>
      </div>

      <div class="transform-section">
        <span class="section-label">选区操作</span>
        <div class="transform-buttons">
          <button class="transform-btn" :disabled="!selectionRect" @click="handleCopy" title="复制选区">
            ⎘ 复制
          </button>
          <button class="transform-btn" :disabled="!store.hasClipboardData() || isLayerLocked" @click="handlePaste" title="粘贴">
            ⎙ 粘贴
          </button>
          <button class="transform-btn" :disabled="!selectionRect || isLayerLocked" @click="fillSelection" title="填充选区">
            ▣ 填充
          </button>
          <button class="transform-btn" :disabled="!selectionRect || isLayerLocked" @click="handleDeleteSelection" title="清除选区">
            ▢ 清除
          </button>
        </div>
      </div>
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
            v-for="(row, rowIndex) in composedGrid"
            :key="'row-' + rowIndex"
            class="grid-row"
          >
            <div
              v-for="(cell, colIndex) in row"
              :key="'cell-' + rowIndex + '-' + colIndex"
              class="grid-cell"
              :class="{
                'has-color': cell !== null,
                'in-selection': isInSelection(rowIndex, colIndex),
                'locked': isLayerLocked
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

    <div class="action-bar">
      <button class="action-btn fill-btn" :disabled="isLayerLocked" @click="handleFillAll">
        全部填充
      </button>
      <button class="action-btn clear-btn" :disabled="isLayerLocked" @click="handleClearAll">
        全部清空
      </button>
      <button class="action-btn toggle-tools-btn" @click="toggleTransformTools">
        {{ showTransformTools ? '收起工具' : '展开工具' }}
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.beat-grid-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
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
  flex-wrap: wrap;

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

  .layer-info {
    font-size: 12px;
    color: #c84b31;
    background: #fff5f2;
    padding: 4px 10px;
    border-radius: 6px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 4px;

    .lock-indicator {
      font-size: 11px;
    }
  }
}

.editor-tools {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.history-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #f8f5f0;
  padding: 4px;
  border-radius: 8px;

  .tool-btn {
    width: 32px;
    height: 28px;
    border: none;
    background: transparent;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    color: #6b5b47;
    transition: all 0.2s ease;

    &:hover:not(:disabled) {
      background: #e8e0d5;
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }
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

.current-color-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: #faf7f2;
  border-radius: 8px;
  border: 1px dashed #e0d5c5;

  .label {
    font-size: 13px;
    color: #8b7355;
  }

  .color-preview {
    width: 22px;
    height: 22px;
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
    font-size: 11px;
    color: #a08b72;
    margin-left: auto;
  }
}

.transform-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 12px;
  background: #faf7f2;
  border-radius: 8px;
}

.transform-section {
  display: flex;
  align-items: center;
  gap: 8px;

  .section-label {
    font-size: 12px;
    color: #8b7355;
    font-weight: 500;
    white-space: nowrap;
  }
}

.transform-buttons {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.transform-btn {
  padding: 5px 10px;
  border: 1px solid #d4c8b8;
  background: #fff;
  color: #6b5b47;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background: #f5f0e6;
    border-color: #c84b31;
    color: #c84b31;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:active:not(:disabled) {
    transform: scale(0.97);
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

  &.locked {
    cursor: not-allowed;

    &:hover {
      box-shadow: none;
    }
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

.action-bar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

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

    &:hover:not(:disabled) {
      background: #b03d26;
    }
  }

  &.clear-btn {
    background: #f0ebe4;
    color: #6b5b47;

    &:hover:not(:disabled) {
      background: #e0d8cc;
    }
  }

  &.toggle-tools-btn {
    margin-left: auto;
    background: #f8f5f0;
    color: #8b7355;

    &:hover {
      background: #e8e0d5;
    }
  }

  &:active:not(:disabled) {
    transform: scale(0.97);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>

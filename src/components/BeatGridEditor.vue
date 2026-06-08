<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePatternStore } from '@/stores/pattern'
import { storeToRefs } from 'pinia'
import { useMessage } from 'naive-ui'

const store = usePatternStore()
const message = useMessage()
const { colors, currentColor, warpCount, weftCycle, currentColorId, activeLayer, layers, canUndo, canRedo, clipboard } = storeToRefs(store)

const isDrawing = ref(false)
const drawMode = ref<'paint' | 'erase'>('paint')
const cellSize = ref(28)
const isSelecting = ref(false)
const selectionStart = ref<{ row: number; col: number } | null>(null)
const selectionEnd = ref<{ row: number; col: number } | null>(null)
const showTransformTools = ref(true)

const isPastingMode = ref(false)
const pastePreviewPos = ref<{ row: number; col: number } | null>(null)

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

const referenceGrid = computed(() => {
  if (!activeLayer.value) return null
  const activeId = activeLayer.value.id
  const activeOrder = activeLayer.value.order
  const visibleBelow = layers.value.filter(
    l => l.visible && l.id !== activeId && l.order < activeOrder
  )
  if (visibleBelow.length === 0) return null

  const grid: (string | null)[][] = []
  for (let r = 0; r < weftCycle.value; r++) {
    const row: (string | null)[] = []
    for (let c = 0; c < warpCount.value; c++) {
      let val: string | null = null
      for (const layer of visibleBelow) {
        if (layer.grid[r]?.[c] !== null) {
          val = layer.grid[r][c]
          break
        }
      }
      row.push(val)
    }
    grid.push(row)
  }
  return grid
})

function getCellColor(cellValue: string | null): string {
  if (cellValue === null) return 'transparent'
  return colorMap.value.get(cellValue) || 'transparent'
}

function getReferenceColor(row: number, col: number): string {
  if (!referenceGrid.value) return 'transparent'
  const val = referenceGrid.value[row]?.[col]
  if (val === null || val === undefined) return 'transparent'
  return colorMap.value.get(val) || 'transparent'
}

const clipboardRows = computed(() => clipboard.value?.length ?? 0)
const clipboardCols = computed(() => clipboard.value?.[0]?.length ?? 0)

function getPastePreviewColor(row: number, col: number): string {
  if (!isPastingMode.value || !pastePreviewPos.value || !clipboard.value) return 'transparent'
  const clip = clipboard.value
  const relRow = row - pastePreviewPos.value.row
  const relCol = col - pastePreviewPos.value.col
  if (relRow < 0 || relRow >= clip.length || relCol < 0 || relCol >= (clip[0]?.length ?? 0)) return 'transparent'
  const val = clip[relRow]?.[relCol]
  if (val === null || val === undefined) return 'transparent'
  return colorMap.value.get(val) || 'transparent'
}

function handleMouseDown(row: number, col: number, event: MouseEvent) {
  if (isPastingMode.value) {
    event.preventDefault()
    if (event.button === 0) {
      doPaste(row, col)
    } else if (event.button === 2) {
      cancelPasteMode()
    }
    return
  }

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

  isDrawing.value = true
  drawMode.value = 'paint'
  store.setCell(row, col, currentColorId.value)
}

function handleMouseEnter(row: number, col: number) {
  if (isPastingMode.value) {
    pastePreviewPos.value = { row, col }
    return
  }

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

function isInPastePreview(row: number, col: number): boolean {
  if (!isPastingMode.value || !pastePreviewPos.value || !clipboard.value) return false
  const clip = clipboard.value
  const relRow = row - pastePreviewPos.value.row
  const relCol = col - pastePreviewPos.value.col
  return relRow >= 0 && relRow < clip.length && relCol >= 0 && relCol < (clip[0]?.length ?? 0) &&
    clip[relRow]?.[relCol] !== null
}

function fillSelection() {
  if (!selectionRect.value || isLayerLocked.value) return
  const { startRow, endRow, startCol, endCol } = selectionRect.value
  store.pauseHistory()
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      store.setCell(r, c, currentColorId.value)
    }
  }
  store.resumeHistory()
  store.saveHistory()
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
  isPastingMode.value = true
  clearSelection()
  message.info('点击网格放置粘贴内容，右键或按 Esc 取消')
}

function doPaste(row: number, col: number) {
  if (isLayerLocked.value) {
    message.warning('当前图层已锁定')
    cancelPasteMode()
    return
  }
  store.pasteSelection(row, col)
  isPastingMode.value = false
  pastePreviewPos.value = null
  message.success('已粘贴')
}

function cancelPasteMode() {
  isPastingMode.value = false
  pastePreviewPos.value = null
  message.info('已取消粘贴')
}

function handleDeleteSelection() {
  if (!selectionRect.value || isLayerLocked.value) return
  const { startRow, endRow, startCol, endCol } = selectionRect.value
  store.pauseHistory()
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      store.setCell(r, c, null)
    }
  }
  store.resumeHistory()
  store.saveHistory()
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

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (isPastingMode.value) {
      cancelPasteMode()
    } else if (isSelecting.value || selectionRect.value) {
      clearSelection()
    }
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault()
    if (e.shiftKey) {
      handleRedo()
    } else {
      handleUndo()
    }
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
    e.preventDefault()
    handleRedo()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <div
    class="beat-grid-editor"
    :class="{ 'pasting-mode': isPastingMode }"
    @mouseup="handleMouseUp"
    @mouseleave="handleMouseLeave"
  >
    <div class="editor-header">
      <div class="editor-title">
        <span class="title-text">节拍网格编辑器</span>
        <span class="grid-info">{{ warpCount }} × {{ weftCycle }}</span>
        <span v-if="activeLayer" class="layer-info">
          当前：{{ activeLayer.name }}
          <span v-if="activeLayer.locked" class="lock-indicator">🔒</span>
        </span>
        <span v-if="isPastingMode" class="pasting-indicator">
          📌 粘贴模式
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
      <span class="hint" v-if="!isPastingMode">
        · 左键绘制 · 右键擦除 · Shift+拖拽框选 · 点击粘贴后选位置
      </span>
      <span class="hint" v-else>
        · 左键确认放置 · 右键/Esc 取消
      </span>
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
          <button
            class="transform-btn paste-btn"
            :class="{ active: isPastingMode }"
            :disabled="!store.hasClipboardData() || isLayerLocked"
            @click="handlePaste"
            title="粘贴（点击进入粘贴模式）"
          >
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
            v-for="(row, rowIndex) in activeLayer?.grid || []"
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
                'locked': isLayerLocked,
                'pasting-mode': isPastingMode,
                'paste-preview': isInPastePreview(rowIndex, colIndex)
              }"
              :style="{
                width: cellSize + 'px',
                height: cellSize + 'px'
              }"
              @mousedown="handleMouseDown(rowIndex, colIndex, $event)"
              @mouseenter="handleMouseEnter(rowIndex, colIndex)"
            >
              <div
                v-if="referenceGrid"
                class="reference-layer"
                :style="{ backgroundColor: getReferenceColor(rowIndex, colIndex) }"
              ></div>
              <div
                class="current-layer"
                :style="{ backgroundColor: getCellColor(cell) }"
              ></div>
              <div
                v-if="isInPastePreview(rowIndex, colIndex)"
                class="paste-preview-layer"
                :style="{ backgroundColor: getPastePreviewColor(rowIndex, colIndex) }"
              ></div>
              <div v-if="cell === null && !referenceGrid?.[rowIndex]?.[colIndex]" class="empty-cell"></div>
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

  &.pasting-mode {
    .grid-container {
      cursor: crosshair;
    }
  }
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

  .pasting-indicator {
    font-size: 12px;
    color: #2d7a4a;
    background: #e8f5ee;
    padding: 4px 10px;
    border-radius: 6px;
    font-weight: 500;
    animation: pulse 1.5s ease-in-out infinite;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
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

  &.paste-btn.active {
    background: #e8f5ee;
    border-color: #2d7a4a;
    color: #2d7a4a;
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
  overflow: hidden;

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

  &.paste-preview {
    box-shadow: 0 0 0 2px #2d7a4a inset;
  }

  &.pasting-mode {
    cursor: crosshair;
  }

  .reference-layer,
  .current-layer,
  .paste-preview-layer {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }

  .reference-layer {
    opacity: 0.3;
  }

  .current-layer {
    z-index: 1;
  }

  .paste-preview-layer {
    z-index: 2;
    opacity: 0.6;
    animation: paste-blink 0.8s ease-in-out infinite;
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
    z-index: 0;
  }
}

@keyframes paste-blink {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 0.8; }
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

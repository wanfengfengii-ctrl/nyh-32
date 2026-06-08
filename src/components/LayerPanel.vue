<script setup lang="ts">
import { ref, computed } from 'vue'
import { usePatternStore } from '@/stores/pattern'
import { storeToRefs } from 'pinia'
import { useMessage } from 'naive-ui'

const store = usePatternStore()
const message = useMessage()
const { sortedLayers, activeLayerId, layers } = storeToRefs(store)

const editingLayerId = ref<string | null>(null)
const editingLayerName = ref('')
const editingLayerNameBackup = ref('')

function selectLayer(layerId: string) {
  store.setActiveLayer(layerId)
}

function toggleVisibility(layerId: string, event: Event) {
  event.stopPropagation()
  store.toggleLayerVisibility(layerId)
}

function toggleLock(layerId: string, event: Event) {
  event.stopPropagation()
  store.toggleLayerLock(layerId)
}

function startRename(layerId: string, event: Event) {
  event.stopPropagation()
  const layer = layers.value.find(l => l.id === layerId)
  if (layer) {
    editingLayerName.value = layer.name
    editingLayerNameBackup.value = layer.name
  }
  editingLayerId.value = layerId
}

function finishRename() {
  if (editingLayerId.value) {
    const trimmedName = editingLayerName.value.trim()
    if (!trimmedName) {
      message.error('图层名称不能为空')
      editingLayerName.value = editingLayerNameBackup.value
    } else {
      store.renameLayer(editingLayerId.value, trimmedName)
    }
  }
  editingLayerId.value = null
  editingLayerName.value = ''
  editingLayerNameBackup.value = ''
}

function handleOpacityChange(layerId: string, value: number) {
  store.setLayerOpacity(layerId, Math.round(value))
}

function addNewLayer() {
  store.addLayer()
  message.success('已添加新图层')
}

function duplicateLayer(layerId: string, event: Event) {
  event.stopPropagation()
  store.duplicateLayer(layerId)
  message.success('已复制图层')
}

function deleteLayer(layerId: string, event: Event) {
  event.stopPropagation()
  if (layers.value.length <= 1) {
    message.warning('至少需要保留一个图层')
    return
  }
  if (confirm('确定要删除该图层吗？')) {
    store.removeLayer(layerId)
    message.success('已删除图层')
  }
}

function moveUp(layerId: string, event: Event) {
  event.stopPropagation()
  store.moveLayerUp(layerId)
}

function moveDown(layerId: string, event: Event) {
  event.stopPropagation()
  store.moveLayerDown(layerId)
}

function canMoveUp(order: number): boolean {
  const maxOrder = layers.value.reduce((max, l) => Math.max(max, l.order), -1)
  return order < maxOrder
}

function canMoveDown(order: number): boolean {
  return order > 0
}
</script>

<template>
  <div class="layer-panel">
    <div class="panel-header">
      <h3 class="panel-title">图层管理</h3>
      <button class="add-layer-btn" @click="addNewLayer">
        <span class="add-icon">+</span>
        新建
      </button>
    </div>

    <div class="layer-list">
      <div
        v-for="layer in sortedLayers"
        :key="layer.id"
        class="layer-item"
        :class="{
          active: activeLayerId === layer.id,
          hidden: !layer.visible,
          locked: layer.locked
        }"
        @click="selectLayer(layer.id)"
      >
        <div class="layer-main">
          <div class="layer-visibility" @click="toggleVisibility(layer.id, $event)">
            <span v-if="layer.visible" class="visibility-icon visible">👁</span>
            <span v-else class="visibility-icon hidden">👁‍🗨</span>
          </div>

          <div v-if="editingLayerId === layer.id" class="layer-name-edit" @click.stop>
            <input
              type="text"
              v-model="editingLayerName"
              @blur="finishRename"
              @keyup.enter="finishRename"
              autofocus
            />
          </div>
          <div v-else class="layer-name">
            <span class="name-text">{{ layer.name }}</span>
            <span v-if="layer.locked" class="lock-badge">🔒</span>
          </div>
        </div>

        <div class="layer-controls" @click.stop>
          <div class="opacity-control">
            <span class="opacity-label">{{ layer.opacity }}%</span>
            <input
              type="range"
              min="0"
              max="100"
              :value="layer.opacity"
              @input="e => handleOpacityChange(layer.id, Number((e.target as HTMLInputElement).value))"
              class="opacity-slider"
            />
          </div>

          <div class="layer-actions">
            <button
              class="action-btn"
              title="上移"
              :disabled="!canMoveUp(layer.order)"
              @click="moveUp(layer.id, $event)"
            >
              ↑
            </button>
            <button
              class="action-btn"
              title="下移"
              :disabled="!canMoveDown(layer.order)"
              @click="moveDown(layer.id, $event)"
            >
              ↓
            </button>
            <button
              class="action-btn"
              :title="layer.locked ? '解锁' : '锁定'"
              @click="toggleLock(layer.id, $event)"
            >
              {{ layer.locked ? '🔒' : '🔓' }}
            </button>
            <button class="action-btn" title="复制" @click="duplicateLayer(layer.id, $event)">
              ⎘
            </button>
            <button
              class="action-btn delete-btn"
              title="删除"
              :disabled="layers.length <= 1"
              @click="deleteLayer(layer.id, $event)"
            >
              🗑
            </button>
          </div>
        </div>

        <div class="layer-order">
          <span class="order-badge">{{ layer.order + 1 }}</span>
        </div>
      </div>
    </div>

    <div class="layer-hint">
      <p>点击图层切换当前编辑图层</p>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.layer-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 12px rgba(61, 44, 30, 0.08);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .panel-title {
    font-size: 16px;
    font-weight: 600;
    color: #3d2c1e;
    margin: 0;
  }
}

.add-layer-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: none;
  background: #c84b31;
  color: white;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #b03d26;
  }

  .add-icon {
    font-size: 14px;
    font-weight: 300;
  }
}

.layer-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 320px;
  overflow-y: auto;
  padding-right: 4px;
}

.layer-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  background: #faf7f2;
  border: 2px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;

  &:hover {
    background: #f5f0e6;
  }

  &.active {
    border-color: #c84b31;
    background: #fff5f2;
  }

  &.hidden {
    opacity: 0.6;
  }

  &.locked {
    .layer-name .name-text {
      color: #a08b72;
    }
  }
}

.layer-main {
  display: flex;
  align-items: center;
  gap: 10px;
}

.layer-visibility {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #e8e0d5;
  }

  .visibility-icon {
    font-size: 14px;

    &.hidden {
      opacity: 0.5;
    }
  }
}

.layer-name {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;

  .name-text {
    font-size: 13px;
    font-weight: 600;
    color: #3d2c1e;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .lock-badge {
    font-size: 12px;
    flex-shrink: 0;
  }
}

.layer-name-edit {
  flex: 1;

  input {
    width: 100%;
    height: 24px;
    padding: 0 8px;
    border: 1px solid #c84b31;
    border-radius: 4px;
    font-size: 13px;
    color: #3d2c1e;
    background: #fff;
    outline: none;
  }
}

.layer-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.opacity-control {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;

  .opacity-label {
    font-size: 11px;
    color: #8b7355;
    min-width: 32px;
    text-align: right;
  }

  .opacity-slider {
    flex: 1;
    height: 4px;
    -webkit-appearance: none;
    appearance: none;
    background: #e8e0d5;
    border-radius: 2px;
    outline: none;
    cursor: pointer;

    &::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 12px;
      height: 12px;
      background: #c84b31;
      border-radius: 50%;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        transform: scale(1.2);
      }
    }

    &::-moz-range-thumb {
      width: 12px;
      height: 12px;
      background: #c84b31;
      border-radius: 50%;
      cursor: pointer;
      border: none;
    }
  }
}

.layer-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;

  .action-btn {
    width: 24px;
    height: 24px;
    border: none;
    background: transparent;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    color: #6b5b47;

    &:hover:not(:disabled) {
      background: #e8e0d5;
      color: #3d2c1e;
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    &.delete-btn:hover {
      background: #fde8e3;
      color: #c84b31;
    }
  }
}

.layer-order {
  position: absolute;
  top: 8px;
  right: 8px;

  .order-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 4px;
    background: #d4c8b8;
    color: #fff;
    font-size: 10px;
    font-weight: 600;
    border-radius: 9px;
  }
}

.layer-hint {
  p {
    margin: 0;
    font-size: 11px;
    color: #a08b72;
    text-align: center;
  }
}
</style>

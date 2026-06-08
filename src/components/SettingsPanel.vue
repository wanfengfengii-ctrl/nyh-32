<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { usePatternStore } from '@/stores/pattern'
import { storeToRefs } from 'pinia'
import { validateHexColor } from '@/utils/validator'
import { useMessage } from 'naive-ui'

const store = usePatternStore()
const message = useMessage()
const { warpCount, weftCycle, colors, currentColorId } = storeToRefs(store)

const editingColorId = ref<string | null>(null)
const editingColorName = ref('')
const editingColorNameBackup = ref('')
const newColorName = ref('')
const newColorValue = ref('#C84B31')
const showAddColor = ref(false)

const WARP_MIN = 1
const WARP_MAX = 200
const WEFT_MIN = 1
const WEFT_MAX = 100

const warpInputRef = ref<HTMLInputElement | null>(null)
const weftInputRef = ref<HTMLInputElement | null>(null)

function handleWarpChange(value: number) {
  if (!Number.isInteger(value)) {
    message.error('经线数量必须是整数')
    resetWarpInput()
    return
  }
  if (value < WARP_MIN || value > WARP_MAX) {
    message.error(`经线数量必须在 ${WARP_MIN} - ${WARP_MAX} 之间`)
    resetWarpInput()
    return
  }
  store.setWarpCount(value)
}

function handleWeftChange(value: number) {
  if (!Number.isInteger(value)) {
    message.error('纬线循环周期必须是整数')
    resetWeftInput()
    return
  }
  if (value < WEFT_MIN || value > WEFT_MAX) {
    message.error(`纬线循环周期必须在 ${WEFT_MIN} - ${WEFT_MAX} 之间`)
    resetWeftInput()
    return
  }
  store.setWeftCycle(value)
}

function resetWarpInput() {
  nextTick(() => {
    if (warpInputRef.value) {
      warpInputRef.value.value = String(warpCount.value)
    }
  })
}

function resetWeftInput() {
  nextTick(() => {
    if (weftInputRef.value) {
      weftInputRef.value.value = String(weftCycle.value)
    }
  })
}

function selectColor(colorId: string) {
  store.setCurrentColor(colorId)
}

function startEditColor(colorId: string) {
  const color = colors.value.find(c => c.id === colorId)
  if (color) {
    editingColorName.value = color.name
    editingColorNameBackup.value = color.name
  }
  editingColorId.value = colorId
}

function finishEditColor() {
  if (editingColorId.value) {
    const trimmedName = editingColorName.value.trim()
    if (!trimmedName) {
      message.error('颜色名称不能为空')
      editingColorName.value = editingColorNameBackup.value
    } else {
      store.updateColor(editingColorId.value, { name: trimmedName })
    }
  }
  editingColorId.value = null
  editingColorName.value = ''
  editingColorNameBackup.value = ''
}

function updateColorName(colorId: string, name: string) {
  editingColorName.value = name
}

function updateColorValue(colorId: string, value: string) {
  if (validateHexColor(value)) {
    store.updateColor(colorId, { value })
  }
}

function handleRemoveColor(colorId: string) {
  if (colors.value.length <= 2) {
    return
  }
  store.removeColor(colorId)
}

function handleAddColor() {
  if (!newColorName.value.trim()) {
    newColorName.value = `颜色${colors.value.length + 1}`
  }
  if (!validateHexColor(newColorValue.value)) {
    return
  }
  store.addColor(newColorName.value.trim(), newColorValue.value)
  newColorName.value = ''
  newColorValue.value = '#C84B31'
  showAddColor.value = false
}

function cancelAddColor() {
  showAddColor.value = false
  newColorName.value = ''
  newColorValue.value = '#C84B31'
}

function canRemoveColor(): boolean {
  return colors.value.length > 2
}
</script>

<template>
  <div class="settings-panel">
    <div class="panel-section">
      <h3 class="section-title">纹样参数</h3>

      <div class="param-group">
        <label class="param-label">经线数量</label>
        <div class="param-control">
          <button
            class="param-btn"
            :disabled="warpCount <= 1"
            @click="handleWarpChange(warpCount - 1)"
          >
            −
          </button>
          <input
            ref="warpInputRef"
            type="number"
            class="param-input"
            :value="warpCount"
            :min="WARP_MIN"
            :max="WARP_MAX"
            @change="e => handleWarpChange(Number((e.target as HTMLInputElement).value))"
            @blur="e => handleWarpChange(Number((e.target as HTMLInputElement).value))"
          />
          <button
            class="param-btn"
            :disabled="warpCount >= WARP_MAX"
            @click="handleWarpChange(warpCount + 1)"
          >
            +
          </button>
        </div>
        <span class="param-hint">范围：1 - 200</span>
      </div>

      <div class="param-group">
        <label class="param-label">纬线循环周期</label>
        <div class="param-control">
          <button
            class="param-btn"
            :disabled="weftCycle <= 1"
            @click="handleWeftChange(weftCycle - 1)"
          >
            −
          </button>
          <input
            ref="weftInputRef"
            type="number"
            class="param-input"
            :value="weftCycle"
            :min="WEFT_MIN"
            :max="WEFT_MAX"
            @change="e => handleWeftChange(Number((e.target as HTMLInputElement).value))"
            @blur="e => handleWeftChange(Number((e.target as HTMLInputElement).value))"
          />
          <button
            class="param-btn"
            :disabled="weftCycle >= WEFT_MAX"
            @click="handleWeftChange(weftCycle + 1)"
          >
            +
          </button>
        </div>
        <span class="param-hint">范围：1 - 100</span>
      </div>
    </div>

    <div class="panel-section">
      <div class="section-header">
        <h3 class="section-title">颜色方案</h3>
        <span class="color-count">{{ colors.length }} 种</span>
      </div>

      <div class="color-list">
        <div
          v-for="color in colors"
          :key="color.id"
          class="color-item"
          :class="{
            active: currentColorId === color.id,
            editing: editingColorId === color.id
          }"
          @click="selectColor(color.id)"
        >
          <div class="color-preview-wrapper">
            <div
              class="color-preview"
              :style="{ backgroundColor: color.value }"
            ></div>
          </div>

          <div v-if="editingColorId === color.id" class="color-edit" @click.stop>
            <input
              ref="colorNameInputRef"
              type="text"
              class="color-name-input"
              v-model="editingColorName"
              @blur="finishEditColor"
              @keyup.enter="finishEditColor"
            />
            <input
              type="color"
              class="color-picker-input"
              :value="color.value"
              @input="e => updateColorValue(color.id, (e.target as HTMLInputElement).value)"
            />
          </div>

          <div v-else class="color-info">
            <span class="color-name">{{ color.name }}</span>
            <span class="color-hex">{{ color.value }}</span>
          </div>

          <div class="color-actions" @click.stop>
            <button
              class="action-icon edit-btn"
              title="编辑"
              @click="startEditColor(color.id)"
            >
              ✎
            </button>
            <button
              v-if="canRemoveColor()"
              class="action-icon delete-btn"
              title="删除"
              @click="handleRemoveColor(color.id)"
            >
              ×
            </button>
          </div>
        </div>

        <div v-if="showAddColor" class="add-color-form" @click.stop>
          <div class="color-preview-wrapper">
            <div
              class="color-preview"
              :style="{ backgroundColor: newColorValue }"
            ></div>
          </div>
          <input
            type="text"
            class="color-name-input"
            v-model="newColorName"
            placeholder="颜色名称"
            @keyup.enter="handleAddColor"
          />
          <input
            type="color"
            class="color-picker-input"
            v-model="newColorValue"
          />
          <div class="form-actions">
            <button class="form-btn confirm-btn" @click="handleAddColor">
              确定
            </button>
            <button class="form-btn cancel-btn" @click="cancelAddColor">
              取消
            </button>
          </div>
        </div>

        <button
          v-else
          class="add-color-btn"
          @click="showAddColor = true"
        >
          <span class="add-icon">+</span>
          添加颜色
        </button>
      </div>

      <p v-if="!canRemoveColor()" class="hint-text">
        至少需要保留 2 种颜色
      </p>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.settings-panel {
  display: flex;
  flex-direction: column;
  gap: 24px;
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(61, 44, 30, 0.08);
  height: fit-content;
}

.panel-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #3d2c1e;
  margin: 0;
}

.color-count {
  font-size: 12px;
  color: #8b7355;
  background: #f5f0e6;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.param-group {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .param-label {
    font-size: 13px;
    font-weight: 500;
    color: #6b5b47;
  }

  .param-control {
    display: flex;
    align-items: center;
    gap: 8px;

    .param-btn {
      width: 32px;
      height: 32px;
      border: none;
      background: #f5f0e6;
      border-radius: 8px;
      cursor: pointer;
      font-size: 16px;
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

      &:active:not(:disabled) {
        transform: scale(0.95);
      }
    }

    .param-input {
      flex: 1;
      height: 32px;
      padding: 0 12px;
      border: 1px solid #e8e0d5;
      border-radius: 8px;
      font-size: 14px;
      color: #3d2c1e;
      text-align: center;
      background: #faf7f2;
      transition: all 0.2s ease;
      outline: none;

      &:focus {
        border-color: #c84b31;
        background: #fff;
      }

      &::-webkit-outer-spin-button,
      &::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }

      &[type='number'] {
        -moz-appearance: textfield;
      }
    }
  }

  .param-hint {
    font-size: 11px;
    color: #a08b72;
  }
}

.color-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.color-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: #faf7f2;
  border: 2px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #f5f0e6;
  }

  &.active {
    border-color: #c84b31;
    background: #fff5f2;
  }

  &.editing {
    background: #fff;
    border-color: #c84b31;
  }

  .color-preview-wrapper {
    flex-shrink: 0;
  }

  .color-preview {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: 2px solid #fff;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
  }

  .color-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;

    .color-name {
      font-size: 13px;
      font-weight: 600;
      color: #3d2c1e;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .color-hex {
      font-size: 11px;
      color: #a08b72;
      text-transform: uppercase;
    }
  }

  .color-edit {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;

    .color-name-input {
      flex: 1;
      height: 28px;
      padding: 0 8px;
      border: 1px solid #e8e0d5;
      border-radius: 6px;
      font-size: 13px;
      color: #3d2c1e;
      outline: none;
      min-width: 0;

      &:focus {
        border-color: #c84b31;
      }
    }

    .color-picker-input {
      width: 32px;
      height: 28px;
      padding: 0;
      border: 1px solid #e8e0d5;
      border-radius: 6px;
      cursor: pointer;

      &::-webkit-color-swatch-wrapper {
        padding: 2px;
      }

      &::-webkit-color-swatch {
        border-radius: 4px;
        border: none;
      }
    }
  }

  .color-actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  &:hover .color-actions {
    opacity: 1;
  }

  .action-icon {
    width: 24px;
    height: 24px;
    border: none;
    background: transparent;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;

    &.edit-btn {
      color: #8b7355;

      &:hover {
        background: #e8e0d5;
        color: #6b5b47;
      }
    }

    &.delete-btn {
      color: #c84b31;

      &:hover {
        background: #fde8e3;
        color: #b03d26;
      }
    }
  }
}

.add-color-form {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: #fff5f2;
  border: 2px dashed #f5c1b3;
  border-radius: 10px;

  .color-preview-wrapper {
    flex-shrink: 0;
  }

  .color-name-input {
    flex: 1;
    height: 30px;
    padding: 0 10px;
    border: 1px solid #e8e0d5;
    border-radius: 6px;
    font-size: 13px;
    color: #3d2c1e;
    outline: none;
    background: #fff;

    &:focus {
      border-color: #c84b31;
    }
  }

  .color-picker-input {
    width: 34px;
    height: 30px;
    padding: 0;
    border: 1px solid #e8e0d5;
    border-radius: 6px;
    cursor: pointer;
    background: #fff;

    &::-webkit-color-swatch-wrapper {
      padding: 2px;
    }

    &::-webkit-color-swatch {
      border-radius: 4px;
      border: none;
    }
  }

  .form-actions {
    display: flex;
    gap: 6px;

    .form-btn {
      padding: 6px 12px;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;

      &.confirm-btn {
        background: #c84b31;
        color: white;

        &:hover {
          background: #b03d26;
        }
      }

      &.cancel-btn {
        background: #f0ebe4;
        color: #6b5b47;

        &:hover {
          background: #e0d8cc;
        }
      }
    }
  }
}

.add-color-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  border: 2px dashed #d4c8b8;
  border-radius: 10px;
  background: #faf7f2;
  color: #8b7355;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  .add-icon {
    font-size: 18px;
    font-weight: 300;
  }

  &:hover {
    border-color: #c84b31;
    color: #c84b31;
    background: #fff5f2;
  }
}

.hint-text {
  font-size: 11px;
  color: #a08b72;
  margin: 0;
  text-align: center;
}
</style>

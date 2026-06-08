<script setup lang="ts">
import { computed, ref } from 'vue'
import { usePatternStore } from '@/stores/pattern'
import { storeToRefs } from 'pinia'
import { useMessage } from 'naive-ui'
import { downloadJsonFile } from '@/utils/pattern'

const store = usePatternStore()
const message = useMessage()
const { processSheet, processNotes } = storeToRefs(store)

const viewMode = ref<'basic' | 'layers' | 'consumption'>('basic')
const newNote = ref('')

const allNotes = computed(() => {
  const baseNotes = processSheet.value.operationNotes
  const customNotes = processNotes.value
  return [...baseNotes, ...customNotes]
})

function handlePrint() {
  window.print()
  message.success('正在准备打印...')
}

function handleExportJson() {
  const data = {
    processSheet: processSheet.value,
    customNotes: processNotes.value
  }
  const filename = `工艺单-${processSheet.value.name}-${Date.now()}.json`
  downloadJsonFile(data, filename)
  message.success('工艺单已导出')
}

function addNote() {
  if (newNote.value.trim()) {
    store.addProcessNote(newNote.value.trim())
    newNote.value = ''
    message.success('备注已添加')
  }
}

function removeNote(index: number) {
  const baseCount = processSheet.value.operationNotes.length
  if (index >= baseCount) {
    store.removeProcessNote(index - baseCount)
    message.success('备注已删除')
  }
}

function switchView(mode: 'basic' | 'layers' | 'consumption') {
  viewMode.value = mode
}
</script>

<template>
  <div class="process-sheet-panel">
    <div class="panel-header">
      <span class="title">工艺单</span>
      <div class="header-actions">
        <button class="action-btn" @click="handleExportJson" title="导出 JSON">
          <span class="btn-icon">↧</span>
          导出
        </button>
        <button class="action-btn primary" @click="handlePrint" title="打印">
          <span class="btn-icon">⎙</span>
          打印
        </button>
      </div>
    </div>

    <div class="view-tabs">
      <button
        class="tab-btn"
        :class="{ active: viewMode === 'basic' }"
        @click="switchView('basic')"
      >
        基本信息
      </button>
      <button
        class="tab-btn"
        :class="{ active: viewMode === 'layers' }"
        @click="switchView('layers')"
      >
        图层说明
      </button>
      <button
        class="tab-btn"
        :class="{ active: viewMode === 'consumption' }"
        @click="switchView('consumption')"
      >
        消耗统计
      </button>
    </div>

    <div class="sheet-content">
      <div v-if="viewMode === 'basic'" class="basic-info">
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">方案名称</span>
            <span class="info-value highlight">{{ processSheet.name }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">经线数量</span>
            <span class="info-value">{{ processSheet.warpCount }} 根</span>
          </div>
          <div class="info-item">
            <span class="info-label">纬线循环</span>
            <span class="info-value">{{ processSheet.weftCycle }} 行</span>
          </div>
          <div class="info-item">
            <span class="info-label">总格数</span>
            <span class="info-value">{{ processSheet.totalCells }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">已填充</span>
            <span class="info-value">{{ processSheet.filledCells }} 格</span>
          </div>
          <div class="info-item">
            <span class="info-label">填充率</span>
            <span class="info-value">{{ (processSheet.fillRate * 100).toFixed(1) }}%</span>
          </div>
        </div>

        <div class="section">
          <h4 class="section-title">颜色清单</h4>
          <div class="color-list">
            <div
              v-for="color in processSheet.usedColors"
              :key="color.id"
              class="color-item"
            >
              <div class="color-dot" :style="{ backgroundColor: color.value }"></div>
              <span class="color-name">{{ color.name }}</span>
              <span class="color-hex">{{ color.value }}</span>
            </div>
          </div>
          <p v-if="processSheet.usedColors.length === 0" class="empty-hint">
            暂无使用的颜色
          </p>
        </div>

        <div class="section">
          <h4 class="section-title">重复次数建议</h4>
          <div class="suggestion-box">
            <span class="suggestion-value">{{ processSheet.suggestedRepeats }}</span>
            <span class="suggestion-label">次循环</span>
          </div>
          <p class="suggestion-hint">
            建议重复 {{ processSheet.suggestedRepeats }} 次，总长约 {{ processSheet.totalWeftBeats }} 排纬线
          </p>
        </div>

        <div class="section">
          <div class="section-header-with-add">
            <h4 class="section-title">操作备注</h4>
          </div>
          <ul class="notes-list">
            <li
              v-for="(note, index) in allNotes"
              :key="index"
              class="note-item"
              :class="{ 'custom-note': index >= processSheet.operationNotes.length }"
            >
              <span class="note-text">{{ note }}</span>
              <button
                v-if="index >= processSheet.operationNotes.length"
                class="note-delete"
                @click="removeNote(index)"
                title="删除"
              >
                ×
              </button>
            </li>
          </ul>
          <div class="add-note">
            <input
              v-model="newNote"
              type="text"
              class="note-input"
              placeholder="添加自定义备注..."
              @keyup.enter="addNote"
            />
            <button class="add-btn" @click="addNote">
              +
            </button>
          </div>
        </div>
      </div>

      <div v-else-if="viewMode === 'layers'" class="layers-info">
        <div class="layers-summary">
          <span class="summary-text">共 {{ processSheet.layers.length }} 个图层</span>
        </div>
        <div class="layers-list">
          <div
            v-for="(layer, index) in processSheet.layers"
            :key="layer.layerId"
            class="layer-card"
          >
            <div class="layer-header">
              <span class="layer-order">#{{ index + 1 }}</span>
              <span class="layer-name">{{ layer.layerName }}</span>
            </div>
            <div class="layer-stats">
              <span class="layer-desc">{{ layer.description }}</span>
              <span class="layer-cells">{{ layer.cellCount }} 格</span>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="viewMode === 'consumption'" class="consumption-info">
        <div class="consumption-section">
          <h4 class="section-title">总消耗统计</h4>
          <div class="consumption-list">
            <div
              v-for="item in processSheet.totalConsumption.filter(c => c.count > 0)"
              :key="item.colorId"
              class="consumption-item"
            >
              <div class="color-info">
                <div class="color-dot" :style="{ backgroundColor: item.colorValue }"></div>
                <span class="color-name">{{ item.colorName }}</span>
              </div>
              <div class="consumption-stats">
                <span class="count">{{ item.count }} 次</span>
                <span class="percentage">{{ (item.percentage * 100).toFixed(1) }}%</span>
              </div>
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  :style="{
                    width: item.percentage * 100 + '%',
                    backgroundColor: item.colorValue
                  }"
                ></div>
              </div>
            </div>
          </div>
          <p v-if="processSheet.totalConsumption.filter(c => c.count > 0).length === 0" class="empty-hint">
            暂无消耗数据
          </p>
        </div>

        <div class="consumption-section">
          <h4 class="section-title">单图层消耗</h4>
          <div class="layer-consumption-list">
            <div
              v-for="layer in processSheet.layerConsumptions"
              :key="layer.layerId"
              class="layer-consumption-item"
            >
              <div class="layer-name-row">
                <span class="layer-name">{{ layer.layerName }}</span>
              </div>
              <div class="mini-consumption">
                <div
                  v-for="item in layer.stats.filter(s => s.count > 0)"
                  :key="item.colorId"
                  class="mini-item"
                  :title="`${item.colorName}: ${item.count} 次`"
                >
                  <div
                    class="mini-dot"
                    :style="{ backgroundColor: item.colorValue }"
                  ></div>
                  <span class="mini-count">{{ item.count }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.process-sheet-panel {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(61, 44, 30, 0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #f0ebe4;

  .title {
    font-size: 18px;
    font-weight: 600;
    color: #3d2c1e;
  }

  .header-actions {
    display: flex;
    gap: 8px;

    .action-btn {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 12px;
      border: 1px solid #e8e0d5;
      border-radius: 6px;
      background: #faf7f2;
      color: #6b5b47;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;

      .btn-icon {
        font-size: 14px;
      }

      &:hover {
        background: #f5f0e6;
        border-color: #d4c8b8;
      }

      &.primary {
        background: #c84b31;
        border-color: #c84b31;
        color: #fff;

        &:hover {
          background: #d65842;
          border-color: #d65842;
        }
      }
    }
  }
}

.view-tabs {
  display: flex;
  padding: 8px 20px;
  background: #faf7f2;
  border-bottom: 1px solid #f0ebe4;

  .tab-btn {
    flex: 1;
    padding: 8px 12px;
    border: none;
    background: transparent;
    color: #8b7355;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.2s ease;

    &.active {
      background: #fff;
      color: #c84b31;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    }

    &:hover:not(.active) {
      color: #6b5b47;
    }
  }
}

.sheet-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  max-height: 600px;
}

.basic-info {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;

  .info-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px;
    background: #faf7f2;
    border-radius: 8px;

    .info-label {
      font-size: 11px;
      color: #8b7355;
      font-weight: 500;
    }

    .info-value {
      font-size: 16px;
      font-weight: 600;
      color: #3d2c1e;

      &.highlight {
        color: #c84b31;
      }
    }
  }
}

.section {
  display: flex;
  flex-direction: column;
  gap: 10px;

  .section-header-with-add {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .section-title {
    font-size: 14px;
    font-weight: 600;
    color: #3d2c1e;
    margin: 0;
  }
}

.color-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  .color-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: #faf7f2;
    border-radius: 8px;

    .color-dot {
      width: 16px;
      height: 16px;
      border-radius: 4px;
      border: 2px solid #fff;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
    }

    .color-name {
      font-size: 13px;
      font-weight: 500;
      color: #3d2c1e;
    }

    .color-hex {
      font-size: 11px;
      color: #a08b72;
      text-transform: uppercase;
    }
  }
}

.empty-hint {
  font-size: 12px;
  color: #a08b72;
  text-align: center;
  padding: 20px;
  margin: 0;
}

.suggestion-box {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 16px;
  background: linear-gradient(135deg, #fff5f2 0%, #faf7f2 100%);
  border-radius: 10px;
  border: 1px solid #f5c1b3;

  .suggestion-value {
    font-size: 32px;
    font-weight: 700;
    color: #c84b31;
    line-height: 1;
  }

  .suggestion-label {
    font-size: 14px;
    color: #8b5a4a;
    font-weight: 500;
  }
}

.suggestion-hint {
  font-size: 12px;
  color: #8b7355;
  margin: 8px 0 0 0;
  padding-left: 4px;
}

.notes-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;

  .note-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: #faf7f2;
    border-radius: 8px;
    border-left: 3px solid #e8e0d5;

    &.custom-note {
      border-left-color: #c84b31;
      background: #fff5f2;
    }

    .note-text {
      flex: 1;
      font-size: 13px;
      color: #6b5b47;
      line-height: 1.5;
    }

    .note-delete {
      width: 24px;
      height: 24px;
      border: none;
      background: transparent;
      color: #c84b31;
      font-size: 18px;
      cursor: pointer;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: all 0.2s ease;

      &:hover {
        background: rgba(200, 75, 49, 0.1);
      }
    }

    &:hover .note-delete {
      opacity: 1;
    }
  }
}

.add-note {
  display: flex;
  gap: 8px;
  margin-top: 8px;

  .note-input {
    flex: 1;
    height: 36px;
    padding: 0 12px;
    border: 1px solid #e8e0d5;
    border-radius: 8px;
    font-size: 13px;
    color: #3d2c1e;
    background: #fff;
    outline: none;
    transition: all 0.2s ease;

    &:focus {
      border-color: #c84b31;
    }

    &::placeholder {
      color: #a08b72;
    }
  }

  .add-btn {
    width: 36px;
    height: 36px;
    border: none;
    background: #c84b31;
    color: #fff;
    font-size: 20px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;

    &:hover {
      background: #d65842;
    }

    &:active {
      transform: scale(0.95);
    }
  }
}

.layers-info {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.layers-summary {
  .summary-text {
    font-size: 13px;
    color: #8b7355;
    font-weight: 500;
  }
}

.layers-list {
  display: flex;
  flex-direction: column;
  gap: 10px;

  .layer-card {
    padding: 14px;
    background: #faf7f2;
    border-radius: 10px;
    border: 1px solid #f0ebe4;
    transition: all 0.2s ease;

    &:hover {
      background: #f5f0e6;
      border-color: #e8e0d5;
    }

    .layer-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;

      .layer-order {
        font-size: 12px;
        font-weight: 700;
        color: #c84b31;
        background: #fff5f2;
        padding: 2px 8px;
        border-radius: 4px;
      }

      .layer-name {
        font-size: 15px;
        font-weight: 600;
        color: #3d2c1e;
      }
    }

    .layer-stats {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .layer-desc {
        font-size: 12px;
        color: #8b7355;
      }

      .layer-cells {
        font-size: 13px;
        font-weight: 600;
        color: #6b5b47;
      }
    }
  }
}

.consumption-info {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.consumption-section {
  display: flex;
  flex-direction: column;
  gap: 12px;

  .section-title {
    font-size: 14px;
    font-weight: 600;
    color: #3d2c1e;
    margin: 0;
  }
}

.consumption-list {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .consumption-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    background: #faf7f2;
    border-radius: 8px;

    .color-info {
      display: flex;
      align-items: center;
      gap: 8px;

      .color-dot {
        width: 14px;
        height: 14px;
        border-radius: 4px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
      }

      .color-name {
        font-size: 13px;
        font-weight: 600;
        color: #3d2c1e;
      }
    }

    .consumption-stats {
      display: flex;
      justify-content: space-between;
      font-size: 12px;

      .count {
        color: #6b5b47;
        font-weight: 500;
      }

      .percentage {
        color: #c84b31;
        font-weight: 600;
      }
    }

    .progress-bar {
      height: 4px;
      background: #e8e0d5;
      border-radius: 2px;
      overflow: hidden;

      .progress-fill {
        height: 100%;
        border-radius: 2px;
        transition: width 0.3s ease;
      }
    }
  }
}

.layer-consumption-list {
  display: flex;
  flex-direction: column;
  gap: 10px;

  .layer-consumption-item {
    padding: 10px 12px;
    background: #faf7f2;
    border-radius: 8px;

    .layer-name-row {
      margin-bottom: 8px;

      .layer-name {
        font-size: 13px;
        font-weight: 600;
        color: #3d2c1e;
      }
    }

    .mini-consumption {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;

      .mini-item {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        background: #fff;
        border-radius: 4px;

        .mini-dot {
          width: 10px;
          height: 10px;
          border-radius: 3px;
        }

        .mini-count {
          font-size: 11px;
          font-weight: 600;
          color: #6b5b47;
        }
      }
    }
  }
}
</style>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { usePatternStore } from '@/stores/pattern'
import { storeToRefs } from 'pinia'
import { useMessage } from 'naive-ui'

const store = usePatternStore()
const message = useMessage()
const { schedulingData, colors, processSheet, schedulingState } = storeToRefs(store)

const stepsContainerRef = ref<HTMLDivElement | null>(null)

const usedColors = computed(() => {
  return processSheet.value.usedColors
})

const currentStep = computed(() => {
  const steps = schedulingData.value.steps
  const idx = schedulingData.value.currentStepIndex
  return steps[idx] || null
})

const progressPercentage = computed(() => {
  const total = schedulingData.value.totalCount
  const completed = schedulingData.value.completedCount
  return total > 0 ? (completed / total) * 100 : 0
})

const repeatCount = computed({
  get: () => schedulingState.value.repeatCount,
  set: (val: number) => store.setSchedulingRepeatCount(val)
})

function handleFilterColor(colorId: string | null) {
  store.setSchedulingFilterColor(colorId)
}

function handleStepClick(stepId: string) {
  store.setCurrentSchedulingStep(stepId)
}

function handleToggleComplete(stepId: string, event: Event) {
  event.stopPropagation()
  store.toggleStepCompleted(stepId)
}

function handlePrevStep() {
  store.goToPrevStep()
  scrollToCurrentStep()
}

function handleNextStep() {
  store.goToNextStep()
  scrollToCurrentStep()
}

function handleResetProgress() {
  store.resetSchedulingProgress()
  message.success('进度已重置')
}

function handleExportJson() {
  store.exportSchedulingJson()
  message.success('排线方案已导出')
}

function handlePrint() {
  window.print()
  message.success('正在准备打印...')
}

function handleRepeatChange(val: number) {
  if (!Number.isInteger(val) || val < 1 || val > 100) {
    message.error('重复次数必须是 1-100 之间的整数')
    return
  }
  store.setSchedulingRepeatCount(val)
}

function scrollToCurrentStep() {
  nextTick(() => {
    if (stepsContainerRef.value && currentStep.value) {
      const stepEl = stepsContainerRef.value.querySelector(
        `[data-step-id="${currentStep.value.id}"]`
      )
      if (stepEl) {
        stepEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  })
}

watch(() => schedulingData.value.currentStepIndex, () => {
  scrollToCurrentStep()
})
</script>

<template>
  <div class="scheduling-view">
    <div class="view-header">
      <span class="title">生产排线</span>
      <div class="header-actions">
        <button class="action-btn" @click="handleResetProgress" title="重置进度">
          <span class="btn-icon">↺</span>
          重置
        </button>
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

    <div class="progress-section">
      <div class="progress-info">
        <span class="progress-label">完成进度</span>
        <span class="progress-value">
          {{ schedulingData.completedCount }} / {{ schedulingData.totalCount }} 步
          <span class="progress-percent">({{ progressPercentage.toFixed(1) }}%)</span>
        </span>
      </div>
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{ width: progressPercentage + '%' }"
        ></div>
      </div>
    </div>

    <div class="controls-section">
      <div class="control-group">
        <label class="control-label">重复次数</label>
        <div class="repeat-control">
          <button
            class="repeat-btn"
            :disabled="repeatCount <= 1"
            @click="handleRepeatChange(repeatCount - 1)"
          >
            −
          </button>
          <input
            type="number"
            class="repeat-input"
            :value="repeatCount"
            min="1"
            max="100"
            @change="e => handleRepeatChange(Number((e.target as HTMLInputElement).value))"
            @blur="e => handleRepeatChange(Number((e.target as HTMLInputElement).value))"
          />
          <button
            class="repeat-btn"
            :disabled="repeatCount >= 100"
            @click="handleRepeatChange(repeatCount + 1)"
          >
            +
          </button>
        </div>
      </div>

      <div class="control-group full-width">
        <label class="control-label">颜色筛选</label>
        <div class="color-filter">
          <button
            class="filter-chip"
            :class="{ active: !schedulingState.filterColorId }"
            @click="handleFilterColor(null)"
          >
            全部
          </button>
          <button
            v-for="color in usedColors"
            :key="color.id"
            class="filter-chip color-chip"
            :class="{ active: schedulingState.filterColorId === color.id }"
            @click="handleFilterColor(color.id)"
          >
            <span
              class="chip-dot"
              :style="{ backgroundColor: color.value }"
            ></span>
            {{ color.name }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="currentStep" class="current-step-card">
      <div class="current-step-header">
        <span class="current-label">当前步骤</span>
        <span class="step-badge" :style="{ backgroundColor: currentStep.colorValue }">
          {{ currentStep.colorName }}
        </span>
      </div>
      <div class="current-step-desc">{{ currentStep.description }}</div>
      <div class="current-step-positions">
        <span class="positions-label">经线位置：</span>
        <div class="positions-list">
          <span
            v-for="pos in currentStep.warpPositions"
            :key="pos"
            class="position-tag"
          >
            {{ pos }}
          </span>
        </div>
      </div>
      <div class="step-nav">
        <button
          class="nav-btn prev"
          :disabled="schedulingData.currentStepIndex === 0"
          @click="handlePrevStep"
        >
          ← 上一步
        </button>
        <button
          class="nav-btn next primary"
          :disabled="schedulingData.currentStepIndex >= schedulingData.steps.length - 1"
          @click="handleNextStep"
        >
          下一步 →
        </button>
      </div>
    </div>

    <div ref="stepsContainerRef" class="steps-list">
      <div
        v-for="step in schedulingData.steps"
        :key="step.id"
        :data-step-id="step.id"
        class="step-item"
        :class="{
          current: schedulingData.steps[schedulingData.currentStepIndex]?.id === step.id,
          completed: step.completed
        }"
        @click="handleStepClick(step.id)"
      >
        <div class="step-left">
          <button
            class="checkbox"
            :class="{ checked: step.completed }"
            @click="e => handleToggleComplete(step.id, e)"
            title="标记完成"
          >
            <span v-if="step.completed">✓</span>
          </button>
          <div class="step-color-dot" :style="{ backgroundColor: step.colorValue }"></div>
        </div>
        <div class="step-content">
          <div class="step-info">
            <span class="step-index">#{{ step.stepIndex + 1 }}</span>
            <span class="step-color-name">{{ step.colorName }}</span>
            <span class="step-beat">第 {{ step.beatIndex + 1 }} 排</span>
            <span class="step-repeat">第 {{ step.repeatIndex + 1 }} 轮</span>
          </div>
          <div class="step-desc">{{ step.description }}</div>
          <div class="step-positions">
            <span
              v-for="pos in step.warpPositions.slice(0, 8)"
              :key="pos"
              class="mini-pos"
            >
              {{ pos }}
            </span>
            <span v-if="step.warpPositions.length > 8" class="more-pos">
              +{{ step.warpPositions.length - 8 }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="schedulingData.steps.length === 0" class="empty-steps">
        <p>暂无排程步骤</p>
        <p class="hint">请先在纹样编辑器中设计图案</p>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.scheduling-view {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(61, 44, 30, 0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  max-height: 700px;
}

.view-header {
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

.progress-section {
  padding: 12px 20px;
  background: #faf7f2;
  border-bottom: 1px solid #f0ebe4;

  .progress-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;

    .progress-label {
      font-size: 13px;
      font-weight: 500;
      color: #6b5b47;
    }

    .progress-value {
      font-size: 13px;
      font-weight: 600;
      color: #3d2c1e;

      .progress-percent {
        color: #c84b31;
        font-weight: 700;
        margin-left: 4px;
      }
    }
  }

  .progress-bar {
    height: 8px;
    background: #e8e0d5;
    border-radius: 4px;
    overflow: hidden;

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #c84b31 0%, #d65842 100%);
      border-radius: 4px;
      transition: width 0.3s ease;
    }
  }
}

.controls-section {
  display: flex;
  gap: 16px;
  padding: 14px 20px;
  border-bottom: 1px solid #f0ebe4;
  flex-wrap: wrap;

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 6px;

    &.full-width {
      flex: 1;
      min-width: 200px;
    }

    .control-label {
      font-size: 12px;
      font-weight: 500;
      color: #8b7355;
    }
  }

  .repeat-control {
    display: flex;
    align-items: center;
    gap: 6px;

    .repeat-btn {
      width: 30px;
      height: 30px;
      border: 1px solid #e8e0d5;
      background: #faf7f2;
      border-radius: 6px;
      font-size: 16px;
      color: #6b5b47;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;

      &:hover:not(:disabled) {
        background: #f5f0e6;
        border-color: #d4c8b8;
      }

      &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
    }

    .repeat-input {
      width: 60px;
      height: 30px;
      padding: 0 8px;
      border: 1px solid #e8e0d5;
      border-radius: 6px;
      text-align: center;
      font-size: 14px;
      font-weight: 600;
      color: #3d2c1e;
      background: #fff;
      outline: none;
      transition: all 0.2s ease;

      &:focus {
        border-color: #c84b31;
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

  .color-filter {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;

    .filter-chip {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border: 1px solid #e8e0d5;
      background: #faf7f2;
      color: #6b5b47;
      font-size: 12px;
      font-weight: 500;
      border-radius: 20px;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        background: #f5f0e6;
        border-color: #d4c8b8;
      }

      &.active {
        background: #c84b31;
        border-color: #c84b31;
        color: #fff;
      }

      &.color-chip {
        .chip-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.3);
        }
      }
    }
  }
}

.current-step-card {
  margin: 14px 20px;
  padding: 16px;
  background: linear-gradient(135deg, #fff5f2 0%, #faf7f2 100%);
  border: 2px solid #c84b31;
  border-radius: 12px;

  .current-step-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;

    .current-label {
      font-size: 12px;
      font-weight: 600;
      color: #c84b31;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .step-badge {
      padding: 4px 10px;
      border-radius: 12px;
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    }
  }

  .current-step-desc {
    font-size: 15px;
    font-weight: 600;
    color: #3d2c1e;
    margin-bottom: 12px;
  }

  .current-step-positions {
    margin-bottom: 14px;

    .positions-label {
      font-size: 12px;
      color: #8b7355;
      font-weight: 500;
    }

    .positions-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 6px;

      .position-tag {
        padding: 4px 10px;
        background: #fff;
        border: 1px solid #f5c1b3;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        color: #c84b31;
      }
    }
  }

  .step-nav {
    display: flex;
    gap: 10px;

    .nav-btn {
      flex: 1;
      padding: 10px 16px;
      border: 1px solid #e8e0d5;
      background: #fff;
      color: #6b5b47;
      font-size: 13px;
      font-weight: 600;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover:not(:disabled) {
        background: #faf7f2;
        border-color: #d4c8b8;
      }

      &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      &.primary {
        background: #c84b31;
        border-color: #c84b31;
        color: #fff;

        &:hover:not(:disabled) {
          background: #d65842;
          border-color: #d65842;
        }
      }
    }
  }
}

.steps-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;

  .step-item {
    display: flex;
    gap: 12px;
    padding: 12px;
    background: #faf7f2;
    border: 2px solid transparent;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      background: #f5f0e6;
    }

    &.current {
      background: #fff5f2;
      border-color: #c84b31;
    }

    &.completed {
      opacity: 0.6;

      .step-desc,
      .step-color-name,
      .step-beat,
      .step-repeat {
        text-decoration: line-through;
      }
    }

    .step-left {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;

      .checkbox {
        width: 22px;
        height: 22px;
        border: 2px solid #d4c8b8;
        border-radius: 6px;
        background: #fff;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        color: #fff;
        transition: all 0.2s ease;

        &:hover {
          border-color: #c84b31;
        }

        &.checked {
          background: #c84b31;
          border-color: #c84b31;
        }
      }

      .step-color-dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
      }
    }

    .step-content {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;

      .step-info {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;

        .step-index {
          font-size: 12px;
          font-weight: 700;
          color: #c84b31;
        }

        .step-color-name {
          font-size: 13px;
          font-weight: 600;
          color: #3d2c1e;
        }

        .step-beat,
        .step-repeat {
          font-size: 11px;
          color: #a08b72;
          background: #f0ebe4;
          padding: 2px 8px;
          border-radius: 4px;
        }
      }

      .step-desc {
        font-size: 12px;
        color: #6b5b47;
        line-height: 1.4;
      }

      .step-positions {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;

        .mini-pos {
          padding: 2px 6px;
          background: #fff;
          border: 1px solid #e8e0d5;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          color: #8b7355;
        }

        .more-pos {
          padding: 2px 6px;
          font-size: 11px;
          color: #a08b72;
        }
      }
    }
  }

  .empty-steps {
    text-align: center;
    padding: 40px 20px;

    p {
      margin: 0;
      color: #8b7355;
      font-size: 14px;

      &.hint {
        font-size: 12px;
        color: #a08b72;
        margin-top: 8px;
      }
    }
  }
}
</style>

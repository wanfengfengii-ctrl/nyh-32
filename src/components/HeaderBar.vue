<script setup lang="ts">
import { ref } from 'vue'
import { usePatternStore } from '@/stores/pattern'
import { storeToRefs } from 'pinia'
import { readJsonFile } from '@/utils/pattern'
import { NModal, NButton, NSpace, useMessage } from 'naive-ui'

const store = usePatternStore()
const { schemaName, colors } = storeToRefs(store)

const message = useMessage()

const showImportModal = ref(false)
const importErrors = ref<string[]>([])
const isImporting = ref(false)
const importFileName = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

function handleNew() {
  store.resetToDefault()
  message.success('已创建新的纹样方案')
}

function handleExport() {
  store.exportSchema()
  message.success('方案已导出')
}

function handleImportClick() {
  importErrors.value = []
  isImporting.value = false
  importFileName.value = ''
  showImportModal.value = true
}

function triggerFileInput() {
  fileInputRef.value?.click()
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  
  if (!file) return

  importFileName.value = file.name
  importErrors.value = []
  isImporting.value = true

  try {
    const data = await readJsonFile(file)
    const result = store.importSchema(data)

    if (result.success) {
      message.success('方案导入成功')
      showImportModal.value = false
    } else {
      importErrors.value = result.errors
    }
  } catch (err: any) {
    importErrors.value = [err.message || '文件读取失败']
  } finally {
    isImporting.value = false
    if (fileInputRef.value) {
      fileInputRef.value.value = ''
    }
  }
}

function handleCloseImport() {
  showImportModal.value = false
  importErrors.value = []
  importFileName.value = ''
}
</script>

<template>
  <header class="header-bar">
    <div class="header-content">
      <div class="logo-section">
      <div class="logo-icon">🧵</div>
      <div class="logo-text">
        <h1 class="app-title">织带纹样设计器</h1>
        <p class="app-subtitle">经纬节拍 · 线材消耗估算</p>
      </div>
    </div>

    <div class="color-strip">
      <div
        v-for="color in colors"
        :key="color.id"
        class="color-swatch"
        :style="{ backgroundColor: color.value }"
        :title="color.name"
      ></div>
    </div>

    <div class="header-actions">
      <button class="action-btn secondary-btn" @click="handleNew">
        <span class="btn-icon">✦</span>
        新建
      </button>
      <button class="action-btn secondary-btn" @click="handleImportClick">
        <span class="btn-icon">↥</span>
        导入
      </button>
      <button class="action-btn primary-btn" @click="handleExport">
        <span class="btn-icon">↧</span>
        导出方案
      </button>
    </div>
  </div>

  <NModal
    v-model:show="showImportModal"
    preset="card"
    title="导入纹样方案"
    :mask-closable="true"
    class="import-modal"
  >
    <div class="import-content">
      <div class="upload-area" @click="triggerFileInput">
        <input
          ref="fileInputRef"
          type="file"
          accept=".json,application/json"
          class="file-input"
          @change="handleFileChange"
        />
        <div class="upload-icon">📄</div>
        <p class="upload-text">点击选择 JSON 文件</p>
        <p class="upload-hint">支持 .json 格式的纹样方案文件</p>
      </div>

      <div v-if="importFileName" class="import-file-name">
        已选择：{{ importFileName }}
      </div>

      <div v-if="isImporting" class="importing-text">
        正在解析文件...
      </div>

      <div v-if="importErrors.length > 0" class="import-errors">
        <div class="errors-title">⚠️ 数据校验失败</div>
        <ul class="errors-list">
          <li v-for="(error, index) in importErrors" :key="index">
            {{ error }}
          </li>
        </ul>
      </div>
    </div>

    <template #footer>
      <NSpace justify="end">
        <NButton @click="handleCloseImport">取消</NButton>
      </NSpace>
    </template>
  </NModal>
  </header>
</template>

<style lang="scss" scoped>
.header-bar {
  background: linear-gradient(135deg, #3d2c1e 0%, #5c4032 100%);
  color: #fff;
  padding: 0 24px;
  box-shadow: 0 2px 12px rgba(61, 44, 30, 0.2);
  position: relative;
  z-index: 100;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 24px;
  height: 68px;
  max-width: 1600px;
  margin: 0 auto;
}

.logo-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  font-size: 32px;
  line-height: 1;
}

.logo-text {
  display: flex;
  flex-direction: column;
  gap: 2px;

  .app-title {
    font-size: 18px;
    font-weight: 700;
    margin: 0;
    color: #fff;
    letter-spacing: 0.5px;
  }

  .app-subtitle {
    font-size: 11px;
    margin: 0;
    color: rgba(255, 255, 255, 0.6);
    font-weight: 400;
  }
}

.color-strip {
  display: flex;
  gap: 4px;
  padding: 4px 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  height: 28px;
  align-items: center;
}

.color-swatch {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  transition: transform 0.2s ease;

  &:hover {
    transform: scale(1.2);
  }
}

.header-actions {
  margin-left: auto;
  display: flex;
  gap: 10px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  .btn-icon {
    font-size: 14px;
  }

  &.primary-btn {
    background: #c84b31;
    color: white;

    &:hover {
      background: #d65842;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(200, 75, 49, 0.4);
    }
  }

  &.secondary-btn {
    background: rgba(255, 255, 255, 0.15);
    color: white;

    &:hover {
      background: rgba(255, 255, 255, 0.25);
    }
  }

  &:active {
    transform: scale(0.97);
  }
}

.import-modal {
  width: 480px;

  :deep(.n-modal-card) {
    border-radius: 12px;
  }
}

.import-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px 0;
}

.upload-area {
  text-align: center;
  padding: 32px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  border: 2px dashed #d4c8b8;
  border-radius: 10px;
  background: #faf7f2;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;

  &:hover {
    border-color: #c84b31;
    background: #fff5f2;
  }

  .file-input {
    display: none;
  }

  .upload-icon {
    font-size: 48px;
  }

  .upload-text {
    font-size: 14px;
    font-weight: 500;
    color: #3d2c1e;
    margin: 0;
  }

  .upload-hint {
    font-size: 12px;
    color: #8b7355;
    margin: 0;
  }
}

.importing-text {
  font-size: 13px;
  color: #c84b31;
  text-align: center;
  padding: 10px;
  background: #fff5f2;
  border-radius: 6px;
}

.import-file-name {
  font-size: 13px;
  color: #6b5b47;
  padding: 10px 12px;
  background: #f5f0e6;
  border-radius: 6px;
}

.import-errors {
  background: #fff0ed;
  border: 1px solid #f5c1b3;
  border-radius: 8px;
  padding: 12px;

  .errors-title {
    font-size: 13px;
    font-weight: 600;
    color: #c84b31;
    margin-bottom: 8px;
  }

  .errors-list {
    margin: 0;
    padding-left: 20px;
    font-size: 12px;
    color: #8b5a4a;

    li {
      margin-bottom: 4px;

      &:last-child {
        margin-bottom: 0;
      }
    }
  }
}
</style>

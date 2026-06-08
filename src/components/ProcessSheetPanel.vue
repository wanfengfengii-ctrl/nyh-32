<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import { usePatternStore } from '@/stores/pattern'
import { storeToRefs } from 'pinia'
import { useMessage } from 'naive-ui'
import { downloadJsonFile } from '@/utils/pattern'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import type { AnnotationTarget } from '@/types'

const store = usePatternStore()
const message = useMessage()
const { processSheet, processNotes, currentReviewVersion } = storeToRefs(store)

const viewMode = ref<'basic' | 'layers' | 'consumption'>('basic')
const newNote = ref('')
const printSheetRef = ref<HTMLDivElement | null>(null)
const isExportingPdf = ref(false)

const showAnnotationModal = ref(false)
const annotationTarget = ref<AnnotationTarget | null>(null)
const newAnnotationContent = ref('')

function openAnnotationModal(target: AnnotationTarget) {
  if (!currentReviewVersion.value) {
    message.warning('请先在打样评审中选择一个版本')
    return
  }
  annotationTarget.value = target
  newAnnotationContent.value = ''
  showAnnotationModal.value = true
}

function handleAddAnnotation() {
  if (!currentReviewVersion.value || !annotationTarget.value) return
  if (!newAnnotationContent.value.trim()) {
    message.error('请输入批注内容')
    return
  }
  store.addAnnotation(
    currentReviewVersion.value.id,
    annotationTarget.value,
    newAnnotationContent.value.trim()
  )
  message.success('批注已添加')
  showAnnotationModal.value = false
}

function getAnnotationCount(targetType: string, targetId: string): number {
  if (!currentReviewVersion.value) return 0
  return store.getAnnotationsForTarget(
    currentReviewVersion.value.id,
    targetType,
    targetId
  ).length
}

const allNotes = computed(() => {
  const baseNotes = processSheet.value.operationNotes
  const customNotes = processNotes.value
  return [...baseNotes, ...customNotes]
})

function handlePrint() {
  if (!printSheetRef.value) return
  
  const printContent = printSheetRef.value.innerHTML
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    message.error('无法打开打印窗口，请检查浏览器弹窗设置')
    return
  }
  
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>工艺单 - ${processSheet.value.name}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
          color: #333;
          padding: 30px;
          background: #fff;
        }
        .print-sheet { max-width: 800px; margin: 0 auto; }
        .print-header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #c84b31; }
        .print-title { font-size: 28px; font-weight: 700; color: #c84b31; margin-bottom: 8px; }
        .print-subtitle { font-size: 14px; color: #888; letter-spacing: 2px; }
        .print-section { margin-bottom: 24px; }
        .print-section-title { font-size: 16px; font-weight: 600; color: #333; margin-bottom: 12px; padding-left: 10px; border-left: 4px solid #c84b31; }
        .print-subsection-title { font-size: 14px; font-weight: 600; color: #555; margin: 16px 0 8px; }
        .print-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        .print-table th, .print-table td {
          border: 1px solid #ddd;
          padding: 10px 12px;
          text-align: left;
          font-size: 13px;
        }
        .print-table th { background: #f9f5f0; font-weight: 600; color: #666; width: 25%; }
        .print-table.full th { width: auto; }
        .print-table.full { width: 100%; }
        .print-summary { font-size: 13px; color: #666; margin-bottom: 10px; }
        .print-empty { font-size: 13px; color: #999; padding: 20px; text-align: center; }
        .print-color-list { display: flex; flex-wrap: wrap; gap: 10px; }
        .print-color-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          background: #f9f5f0;
          border-radius: 6px;
        }
        .print-color-no {
          width: 22px;
          height: 22px;
          background: #c84b31;
          color: #fff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
        }
        .print-color-dot {
          width: 16px;
          height: 16px;
          border-radius: 4px;
          border: 2px solid #fff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.15);
          display: inline-block;
          vertical-align: middle;
        }
        .print-color-name { font-size: 13px; font-weight: 500; color: #333; }
        .print-color-hex { font-size: 11px; color: #999; font-family: monospace; }
        .print-layer-consumption { display: flex; flex-direction: column; gap: 10px; }
        .print-layer-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 14px;
          background: #f9f5f0;
          border-radius: 6px;
        }
        .print-layer-name { font-size: 13px; font-weight: 600; color: #333; }
        .print-layer-stats { display: flex; gap: 8px; }
        .print-stat-chip {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          background: #fff;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          color: #555;
        }
        .print-stat-dot { width: 8px; height: 8px; border-radius: 2px; }
        .print-suggestion {
          display: flex;
          align-items: baseline;
          gap: 10px;
          padding: 16px 20px;
          background: linear-gradient(135deg, #fff5f2 0%, #faf7f2 100%);
          border-radius: 8px;
          border: 1px solid #f5c1b3;
          margin-bottom: 8px;
        }
        .print-suggestion-value { font-size: 32px; font-weight: 700; color: #c84b31; line-height: 1; }
        .print-suggestion-label { font-size: 14px; color: #8b5a4a; font-weight: 500; }
        .print-suggestion-hint { font-size: 12px; color: #8b7355; padding-left: 4px; }
        .print-notes { padding-left: 20px; margin: 0; }
        .print-note { font-size: 13px; color: #555; line-height: 1.8; }
        .print-footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          text-align: center;
          font-size: 12px;
          color: #999;
        }
        .print-footer p { margin: 4px 0; }
        @media print {
          body { padding: 15px; }
          .print-section { page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="print-sheet">${printContent}</div>
    </body>
    </html>
  `)
  
  printWindow.document.close()
  printWindow.focus()
  
  setTimeout(() => {
    printWindow.print()
  }, 200)
  
  message.success('正在准备打印...')
}

async function handleExportPdf() {
  if (!printSheetRef.value) return
  
  isExportingPdf.value = true
  const loadingMsg = message.loading('正在生成 PDF...', { duration: 0 })
  
  try {
    const canvas = await html2canvas(printSheetRef.value, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    })
    
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })
    
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = pdf.internal.pageSize.getHeight()
    const imgWidth = canvas.width
    const imgHeight = canvas.height
    
    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight)
    const imgX = (pdfWidth - imgWidth * ratio) / 2
    const imgY = 10
    
    pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio)
    
    const filename = `工艺单-${processSheet.value.name}-${Date.now()}.pdf`
    pdf.save(filename)
    
    loadingMsg.destroy()
    message.success('PDF 已导出')
  } catch (error) {
    console.error('PDF export error:', error)
    loadingMsg.destroy()
    message.error('PDF 导出失败，请重试')
  } finally {
    isExportingPdf.value = false
  }
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
          JSON
        </button>
        <button class="action-btn" @click="handleExportPdf" :disabled="isExportingPdf" title="导出 PDF">
          <span class="btn-icon">📄</span>
          PDF
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
              <button
                v-if="currentReviewVersion"
                class="annotation-btn"
                @click="openAnnotationModal({ type: 'color', targetId: color.id })"
                :title="`添加批注 (${getAnnotationCount('color', color.id)})`"
              >
                💬
                <span v-if="getAnnotationCount('color', color.id) > 0" class="annotation-count">
                  {{ getAnnotationCount('color', color.id) }}
                </span>
              </button>
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
              <div class="note-actions">
                <button
                  v-if="currentReviewVersion"
                  class="annotation-btn small"
                  @click="openAnnotationModal({ type: 'note', targetId: `note-${index}`, targetIndex: index })"
                  :title="`添加批注 (${getAnnotationCount('note', `note-${index}`)})`"
                >
                  💬
                  <span v-if="getAnnotationCount('note', `note-${index}`) > 0" class="annotation-count">
                    {{ getAnnotationCount('note', `note-${index}`) }}
                  </span>
                </button>
                <button
                  v-if="index >= processSheet.operationNotes.length"
                  class="note-delete"
                  @click="removeNote(index)"
                  title="删除"
                >
                  ×
                </button>
              </div>
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
              <button
                v-if="currentReviewVersion"
                class="annotation-btn small"
                @click="openAnnotationModal({ type: 'layer', targetId: layer.layerId, targetIndex: index })"
                :title="`添加批注 (${getAnnotationCount('layer', layer.layerId)})`"
              >
                💬
                <span v-if="getAnnotationCount('layer', layer.layerId) > 0" class="annotation-count">
                  {{ getAnnotationCount('layer', layer.layerId) }}
                </span>
              </button>
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

  <div ref="printSheetRef" class="print-sheet">
    <div class="print-header">
      <h1 class="print-title">织带纹样工艺单</h1>
      <p class="print-subtitle">Weaving Pattern Process Sheet</p>
    </div>

    <div class="print-section">
      <h2 class="print-section-title">一、基本信息</h2>
      <table class="print-table">
        <tr>
          <th>方案名称</th>
          <td>{{ processSheet.name }}</td>
          <th>经线数量</th>
          <td>{{ processSheet.warpCount }} 根</td>
        </tr>
        <tr>
          <th>纬线循环</th>
          <td>{{ processSheet.weftCycle }} 行</td>
          <th>总格数</th>
          <td>{{ processSheet.totalCells }} 格</td>
        </tr>
        <tr>
          <th>已填充</th>
          <td>{{ processSheet.filledCells }} 格</td>
          <th>填充率</th>
          <td>{{ (processSheet.fillRate * 100).toFixed(1) }}%</td>
        </tr>
      </table>
    </div>

    <div class="print-section">
      <h2 class="print-section-title">二、颜色清单</h2>
      <div v-if="processSheet.usedColors.length > 0" class="print-color-list">
        <div
          v-for="(color, index) in processSheet.usedColors"
          :key="color.id"
          class="print-color-item"
        >
          <span class="print-color-no">{{ index + 1 }}</span>
          <div class="print-color-dot" :style="{ backgroundColor: color.value }"></div>
          <span class="print-color-name">{{ color.name }}</span>
          <span class="print-color-hex">{{ color.value.toUpperCase() }}</span>
        </div>
      </div>
      <p v-else class="print-empty">暂无使用的颜色</p>
    </div>

    <div class="print-section">
      <h2 class="print-section-title">三、图层说明</h2>
      <p class="print-summary">共 {{ processSheet.layers.length }} 个图层</p>
      <table class="print-table full">
        <thead>
          <tr>
            <th>序号</th>
            <th>图层名称</th>
            <th>说明</th>
            <th>格数</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(layer, index) in processSheet.layers" :key="layer.layerId">
            <td>{{ index + 1 }}</td>
            <td>{{ layer.layerName }}</td>
            <td>{{ layer.description }}</td>
            <td>{{ layer.cellCount }} 格</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="print-section">
      <h2 class="print-section-title">四、消耗统计</h2>
      
      <h3 class="print-subsection-title">总消耗统计</h3>
      <div v-if="processSheet.totalConsumption.filter(c => c.count > 0).length > 0">
        <table class="print-table full">
          <thead>
            <tr>
              <th>颜色</th>
              <th>使用次数</th>
              <th>占比</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in processSheet.totalConsumption.filter(c => c.count > 0)" :key="item.colorId">
              <td>
                <span class="print-color-dot" :style="{ backgroundColor: item.colorValue }"></span>
                {{ item.colorName }}
              </td>
              <td>{{ item.count }} 次</td>
              <td>{{ (item.percentage * 100).toFixed(1) }}%</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="print-empty">暂无消耗数据</p>

      <h3 class="print-subsection-title">单图层消耗</h3>
      <div class="print-layer-consumption">
        <div
          v-for="layer in processSheet.layerConsumptions"
          :key="layer.layerId"
          class="print-layer-item"
        >
          <span class="print-layer-name">{{ layer.layerName }}</span>
          <div class="print-layer-stats">
            <span
              v-for="stat in layer.stats.filter(s => s.count > 0)"
              :key="stat.colorId"
              class="print-stat-chip"
            >
              <span class="print-stat-dot" :style="{ backgroundColor: stat.colorValue }"></span>
              {{ stat.count }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="print-section">
      <h2 class="print-section-title">五、重复次数建议</h2>
      <div class="print-suggestion">
        <span class="print-suggestion-value">{{ processSheet.suggestedRepeats }}</span>
        <span class="print-suggestion-label">次循环</span>
      </div>
      <p class="print-suggestion-hint">
        建议重复 {{ processSheet.suggestedRepeats }} 次，总长约 {{ processSheet.totalWeftBeats }} 排纬线
      </p>
    </div>

    <div class="print-section">
      <h2 class="print-section-title">六、操作备注</h2>
      <ol class="print-notes">
        <li v-for="(note, index) in allNotes" :key="index" class="print-note">
          {{ note }}
        </li>
      </ol>
    </div>

    <div class="print-footer">
      <p>生成时间：{{ new Date().toLocaleString('zh-CN') }}</p>
      <p>织带纹样设计器 · 工艺单自动生成</p>
    </div>
  </div>

  <div v-if="showAnnotationModal" class="modal-overlay" @click.self="showAnnotationModal = false">
    <div class="modal-content">
      <h3 class="modal-title">添加批注</h3>
      <div class="form-group">
        <label class="form-label">批注内容</label>
        <textarea
          v-model="newAnnotationContent"
          class="form-textarea"
          placeholder="输入批注内容..."
          rows="4"
          autofocus
        ></textarea>
      </div>
      <div class="modal-actions">
        <button class="cancel-btn" @click="showAnnotationModal = false">取消</button>
        <button class="confirm-btn" @click="handleAddAnnotation">添加</button>
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

.print-sheet {
  position: fixed;
  left: -9999px;
  top: 0;
  width: 800px;
  background: #fff;
  padding: 30px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  color: #333;
  z-index: -1;

  .print-header {
    text-align: center;
    margin-bottom: 30px;
    padding-bottom: 20px;
    border-bottom: 2px solid #c84b31;

    .print-title {
      font-size: 28px;
      font-weight: 700;
      color: #c84b31;
      margin: 0 0 8px 0;
    }

    .print-subtitle {
      font-size: 14px;
      color: #888;
      letter-spacing: 2px;
      margin: 0;
    }
  }

  .print-section {
    margin-bottom: 24px;

    .print-section-title {
      font-size: 16px;
      font-weight: 600;
      color: #333;
      margin: 0 0 12px 0;
      padding-left: 10px;
      border-left: 4px solid #c84b31;
    }

    .print-subsection-title {
      font-size: 14px;
      font-weight: 600;
      color: #555;
      margin: 16px 0 8px 0;
    }
  }

  .print-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 10px;

    th, td {
      border: 1px solid #ddd;
      padding: 10px 12px;
      text-align: left;
      font-size: 13px;
    }

    th {
      background: #f9f5f0;
      font-weight: 600;
      color: #666;
      width: 25%;
    }

    &.full th {
      width: auto;
    }
  }

  .print-summary {
    font-size: 13px;
    color: #666;
    margin-bottom: 10px;
  }

  .print-empty {
    font-size: 13px;
    color: #999;
    padding: 20px;
    text-align: center;
  }

  .print-color-list {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .print-color-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    background: #f9f5f0;
    border-radius: 6px;

    .print-color-no {
      width: 22px;
      height: 22px;
      background: #c84b31;
      color: #fff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;
    }

    .print-color-dot {
      width: 16px;
      height: 16px;
      border-radius: 4px;
      border: 2px solid #fff;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
    }

    .print-color-name {
      font-size: 13px;
      font-weight: 500;
      color: #333;
    }

    .print-color-hex {
      font-size: 11px;
      color: #999;
      font-family: monospace;
    }
  }

  .print-layer-consumption {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .print-layer-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    background: #f9f5f0;
    border-radius: 6px;

    .print-layer-name {
      font-size: 13px;
      font-weight: 600;
      color: #333;
    }

    .print-layer-stats {
      display: flex;
      gap: 8px;
    }

    .print-stat-chip {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      background: #fff;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      color: #555;

      .print-stat-dot {
        width: 8px;
        height: 8px;
        border-radius: 2px;
      }
    }
  }

  .print-suggestion {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 16px 20px;
    background: linear-gradient(135deg, #fff5f2 0%, #faf7f2 100%);
    border-radius: 8px;
    border: 1px solid #f5c1b3;
    margin-bottom: 8px;

    .print-suggestion-value {
      font-size: 32px;
      font-weight: 700;
      color: #c84b31;
      line-height: 1;
    }

    .print-suggestion-label {
      font-size: 14px;
      color: #8b5a4a;
      font-weight: 500;
    }
  }

  .print-suggestion-hint {
    font-size: 12px;
    color: #8b7355;
    padding-left: 4px;
  }

  .print-notes {
    padding-left: 20px;
    margin: 0;

    .print-note {
      font-size: 13px;
      color: #555;
      line-height: 1.8;
    }
  }

  .print-footer {
    margin-top: 40px;
    padding-top: 20px;
    border-top: 1px solid #ddd;
    text-align: center;
    font-size: 12px;
    color: #999;

    p {
      margin: 4px 0;
    }
  }
}

.annotation-btn {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 6px;
  border: none;
  background: #f0f5ff;
  color: #1890ff;
  font-size: 12px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s ease;

  &:hover {
    background: #e6f0ff;
  }

  &.small {
    padding: 1px 5px;
    font-size: 11px;
  }

  .annotation-count {
    background: #1890ff;
    color: #fff;
    font-size: 10px;
    font-weight: 600;
    padding: 1px 5px;
    border-radius: 8px;
    min-width: 16px;
    text-align: center;
  }
}

.note-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  width: 90%;
  max-width: 420px;
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}

.modal-title {
  font-size: 16px;
  font-weight: 600;
  color: #3d2c1e;
  margin: 0 0 16px 0;
}

.form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: #6b5b47;
  margin-bottom: 6px;
}

.form-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e8e0d5;
  border-radius: 8px;
  font-size: 13px;
  color: #3d2c1e;
  background: #fff;
  outline: none;
  box-sizing: border-box;
  resize: vertical;
  font-family: inherit;
  line-height: 1.5;
  transition: all 0.2s ease;

  &:focus {
    border-color: #c84b31;
  }

  &::placeholder {
    color: #a08b72;
  }
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}

.cancel-btn {
  padding: 6px 16px;
  border: 1px solid #e8e0d5;
  background: #fff;
  color: #6b5b47;
  font-size: 13px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #faf7f2;
  }
}

.confirm-btn {
  padding: 6px 16px;
  border: none;
  background: #c84b31;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #d65842;
  }
}
</style>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { usePatternStore } from '@/stores/pattern'
import { storeToRefs } from 'pinia'
import { useMessage } from 'naive-ui'
import { downloadJsonFile } from '@/utils/pattern'
import type { ReviewStatus, Annotation } from '@/types'

const store = usePatternStore()
const message = useMessage()

const showDeleteConfirm = ref(false)
const pendingDeleteVersionId = ref<string | null>(null)
const showDeleteAnnotationConfirm = ref(false)
const pendingDeleteAnnotationId = ref<string | null>(null)

const {
  sortedReviewVersions,
  currentReviewVersion,
  activeReviewTab,
  reviewComparisonResult,
  compareVersionIds
} = storeToRefs(store)

const showCreateModal = ref(false)
const newVersionName = ref('')
const newVersionDesc = ref('')
const newVersionAssignee = ref('')

const showConclusionModal = ref(false)
const conclusionText = ref('')

const newComment = ref('')
const newAnnotationContent = ref('')
const showAnnotationPanel = ref(false)

const statusOptions: { label: string; value: ReviewStatus; color: string }[] = [
  { label: '待评审', value: 'pending', color: '#faad14' },
  { label: '评审中', value: 'in-review', color: '#1890ff' },
  { label: '已通过', value: 'approved', color: '#52c41a' },
  { label: '已拒绝', value: 'rejected', color: '#ff4d4f' },
  { label: '需修改', value: 'needs-revision', color: '#fa8c16' }
]

function getStatusInfo(status: ReviewStatus) {
  return statusOptions.find(s => s.value === status) || statusOptions[0]
}

function formatDate(dateStr: string) {
  try {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return dateStr
  }
}

function handleCreateVersion() {
  if (!newVersionName.value.trim()) {
    message.error('请输入版本名称')
    return
  }
  store.createSampleVersion(
    newVersionName.value.trim(),
    newVersionDesc.value.trim(),
    newVersionAssignee.value.trim() || '未分配'
  )
  message.success('打样版本已创建')
  showCreateModal.value = false
  newVersionName.value = ''
  newVersionDesc.value = ''
  newVersionAssignee.value = ''
}

function handleDeleteVersion(versionId: string) {
  pendingDeleteVersionId.value = versionId
  showDeleteConfirm.value = true
}

function confirmDeleteVersion() {
  if (pendingDeleteVersionId.value) {
    store.deleteSampleVersion(pendingDeleteVersionId.value)
    message.success('版本已删除')
  }
  showDeleteConfirm.value = false
  pendingDeleteVersionId.value = null
}

function cancelDeleteVersion() {
  showDeleteConfirm.value = false
  pendingDeleteVersionId.value = null
}

function handleSelectVersion(versionId: string) {
  store.setCurrentReviewVersion(versionId)
}

function handleStatusChange(status: ReviewStatus) {
  if (!currentReviewVersion.value) return
  store.updateReviewStatus(currentReviewVersion.value.id, status)
  message.success('状态已更新')
}

function handleOpenConclusion() {
  if (!currentReviewVersion.value) return
  conclusionText.value = currentReviewVersion.value.reviewConclusion || ''
  showConclusionModal.value = true
}

function handleSaveConclusion() {
  if (!currentReviewVersion.value) return
  store.updateReviewConclusion(currentReviewVersion.value.id, conclusionText.value)
  message.success('评审结论已保存')
  showConclusionModal.value = false
}

function handleAddComment() {
  if (!currentReviewVersion.value || !newComment.value.trim()) return
  store.addReviewComment(currentReviewVersion.value.id, newComment.value.trim())
  newComment.value = ''
  message.success('评论已添加')
}

function handleSetCompareVersion(index: number, versionId: string) {
  if (!compareVersionIds.value) {
    const firstVersion = sortedReviewVersions.value[0]?.id
    if (firstVersion) {
      store.setCompareVersions(firstVersion, versionId)
    }
  } else {
    const [id1, id2] = compareVersionIds.value
    if (index === 0) {
      store.setCompareVersions(versionId, id2)
    } else {
      store.setCompareVersions(id1, versionId)
    }
  }
}

function handleClearCompare() {
  store.clearCompareVersions()
}

function handleSwitchTab(tab: 'versions' | 'comparison' | 'annotations') {
  store.setActiveReviewTab(tab)
}

function handleExportJson() {
  if (!currentReviewVersion.value) return
  const result = store.exportReviewReport(currentReviewVersion.value.id)
  if (result.success && result.data) {
    const filename = `评审报告-${currentReviewVersion.value.name}-${Date.now()}.json`
    downloadJsonFile(result.data, filename)
    message.success('评审报告已导出')
  }
}

function handleExportReport() {
  if (!currentReviewVersion.value) return
  const version = currentReviewVersion.value
  const statusInfo = getStatusInfo(version.status)
  
  const reportHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #333;">
      <div style="text-align: center; border-bottom: 3px solid #c84b31; padding-bottom: 20px; margin-bottom: 30px;">
        <h1 style="font-size: 28px; color: #c84b31; margin: 0 0 8px 0;">织带纹样打样评审报告</h1>
        <p style="color: #888; letter-spacing: 2px; margin: 0;">Pattern Sample Review Report</p>
      </div>
      
      <div style="background: #f9f5f0; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div>
            <div style="font-size: 12px; color: #888; margin-bottom: 4px;">版本名称</div>
            <div style="font-size: 16px; font-weight: 600; color: #333;">${version.name}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: #888; margin-bottom: 4px;">版本号</div>
            <div style="font-size: 16px; font-weight: 600; color: #c84b31;">V${version.versionNumber}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: #888; margin-bottom: 4px;">负责人</div>
            <div style="font-size: 14px; color: #333;">${version.assignee}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: #888; margin-bottom: 4px;">评审状态</div>
            <div style="display: inline-block; padding: 4px 12px; border-radius: 12px; color: #fff; font-size: 12px; font-weight: 500; background: ${statusInfo.color};">${statusInfo.label}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: #888; margin-bottom: 4px;">创建时间</div>
            <div style="font-size: 13px; color: #555;">${formatDate(version.createdAt)}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: #888; margin-bottom: 4px;">更新时间</div>
            <div style="font-size: 13px; color: #555;">${formatDate(version.updatedAt)}</div>
          </div>
        </div>
      </div>
      
      ${version.description ? `
      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 16px; color: #333; margin: 0 0 12px 0; padding-left: 10px; border-left: 4px solid #c84b31;">版本描述</h3>
        <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0; padding: 12px 16px; background: #faf7f2; border-radius: 6px;">${version.description}</p>
      </div>
      ` : ''}
      
      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 16px; color: #333; margin: 0 0 12px 0; padding-left: 10px; border-left: 4px solid #c84b31;">基本参数</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <th style="text-align: left; padding: 10px 12px; border: 1px solid #ddd; background: #f9f5f0; width: 25%;">经线数量</th>
            <td style="padding: 10px 12px; border: 1px solid #ddd;">${version.snapshot.warpCount} 根</td>
            <th style="text-align: left; padding: 10px 12px; border: 1px solid #ddd; background: #f9f5f0; width: 25%;">纬线循环</th>
            <td style="padding: 10px 12px; border: 1px solid #ddd;">${version.snapshot.weftCycle} 行</td>
          </tr>
          <tr>
            <th style="text-align: left; padding: 10px 12px; border: 1px solid #ddd; background: #f9f5f0;">颜色数量</th>
            <td style="padding: 10px 12px; border: 1px solid #ddd;">${version.snapshot.colors.length} 种</td>
            <th style="text-align: left; padding: 10px 12px; border: 1px solid #ddd; background: #f9f5f0;">建议重复</th>
            <td style="padding: 10px 12px; border: 1px solid #ddd;">${version.snapshot.suggestedRepeats} 次</td>
          </tr>
          <tr>
            <th style="text-align: left; padding: 10px 12px; border: 1px solid #ddd; background: #f9f5f0;">图层数量</th>
            <td style="padding: 10px 12px; border: 1px solid #ddd;">${version.snapshot.layers.length} 个</td>
            <th style="text-align: left; padding: 10px 12px; border: 1px solid #ddd; background: #f9f5f0;">排线步骤</th>
            <td style="padding: 10px 12px; border: 1px solid #ddd;">${version.snapshot.schedulingSteps.length} 步</td>
          </tr>
        </table>
      </div>
      
      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 16px; color: #333; margin: 0 0 12px 0; padding-left: 10px; border-left: 4px solid #c84b31;">批注统计</h3>
        <div style="display: flex; gap: 16px;">
          <div style="flex: 1; text-align: center; padding: 16px; background: #f0f5ff; border-radius: 8px;">
            <div style="font-size: 24px; font-weight: 700; color: #1890ff;">${version.annotations.length}</div>
            <div style="font-size: 12px; color: #666; margin-top: 4px;">总批注</div>
          </div>
          <div style="flex: 1; text-align: center; padding: 16px; background: #f6ffed; border-radius: 8px;">
            <div style="font-size: 24px; font-weight: 700; color: #52c41a;">${version.annotations.filter(a => a.resolved).length}</div>
            <div style="font-size: 12px; color: #666; margin-top: 4px;">已解决</div>
          </div>
          <div style="flex: 1; text-align: center; padding: 16px; background: #fff7e6; border-radius: 8px;">
            <div style="font-size: 24px; font-weight: 700; color: #fa8c16;">${version.annotations.filter(a => !a.resolved).length}</div>
            <div style="font-size: 12px; color: #666; margin-top: 4px;">待解决</div>
          </div>
        </div>
      </div>
      
      ${version.reviewConclusion ? `
      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 16px; color: #333; margin: 0 0 12px 0; padding-left: 10px; border-left: 4px solid #c84b31;">评审结论</h3>
        <div style="padding: 16px 20px; background: linear-gradient(135deg, #fff5f2 0%, #faf7f2 100%); border-radius: 8px; border: 1px solid #f5c1b3;">
          <p style="font-size: 14px; color: #333; line-height: 1.6; margin: 0 0 8px 0;">${version.reviewConclusion}</p>
          <p style="font-size: 12px; color: #8b7355; margin: 0;">评审人：${version.reviewedBy || '未知'} · ${formatDate(version.reviewedAt || '')}</p>
        </div>
      </div>
      ` : ''}
      
      ${version.comments.length > 0 ? `
      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 16px; color: #333; margin: 0 0 12px 0; padding-left: 10px; border-left: 4px solid #c84b31;">评审评论</h3>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${version.comments.map(c => `
            <div style="padding: 12px 16px; background: #faf7f2; border-radius: 8px; border-left: 3px solid #c84b31;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                <span style="font-weight: 600; color: #c84b31; font-size: 13px;">${c.author}</span>
                <span style="font-size: 11px; color: #999;">${formatDate(c.createdAt)}</span>
              </div>
              <p style="font-size: 13px; color: #555; line-height: 1.5; margin: 0;">${c.content}</p>
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}
      
      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; font-size: 12px; color: #999;">
        <p>生成时间：${formatDate(new Date().toISOString())}</p>
        <p>织带纹样设计器 · 打样评审报告</p>
      </div>
    </div>
  `
  
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    message.error('无法打开打印窗口，请检查浏览器弹窗设置')
    return
  }
  
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>评审报告 - ${version.name}</title>
      <style>
        @media print {
          body { padding: 0; }
        }
      </style>
    </head>
    <body>${reportHtml}</body>
    </html>
  `)
  
  printWindow.document.close()
  printWindow.focus()
  
  setTimeout(() => {
    printWindow.print()
  }, 200)
  
  message.success('正在准备打印...')
}

function getTargetTypeName(type: string) {
  const map: Record<string, string> = {
    note: '备注',
    color: '颜色',
    layer: '图层',
    'scheduling-step': '排线步骤'
  }
  return map[type] || type
}

function handleResolveAnnotation(annotationId: string) {
  if (!currentReviewVersion.value) return
  store.resolveAnnotation(currentReviewVersion.value.id, annotationId)
  message.success('批注已标记为已解决')
}

function handleUnresolveAnnotation(annotationId: string) {
  if (!currentReviewVersion.value) return
  store.unresolveAnnotation(currentReviewVersion.value.id, annotationId)
  message.success('批注已重新打开')
}

function handleDeleteAnnotation(annotationId: string) {
  pendingDeleteAnnotationId.value = annotationId
  showDeleteAnnotationConfirm.value = true
}

function confirmDeleteAnnotation() {
  if (currentReviewVersion.value && pendingDeleteAnnotationId.value) {
    store.deleteAnnotation(currentReviewVersion.value.id, pendingDeleteAnnotationId.value)
    message.success('批注已删除')
  }
  showDeleteAnnotationConfirm.value = false
  pendingDeleteAnnotationId.value = null
}

function cancelDeleteAnnotation() {
  showDeleteAnnotationConfirm.value = false
  pendingDeleteAnnotationId.value = null
}

const diffTypeLabels: Record<string, { label: string; color: string }> = {
  added: { label: '新增', color: '#52c41a' },
  removed: { label: '删除', color: '#ff4d4f' },
  modified: { label: '修改', color: '#fa8c16' },
  unchanged: { label: '未变', color: '#8c8c8c' }
}

function getDiffTypeInfo(type: string) {
  return diffTypeLabels[type] || diffTypeLabels.unchanged
}
</script>

<template>
  <div class="review-panel">
    <div class="panel-header">
      <span class="title">打样评审</span>
      <div class="header-actions">
        <button
          class="action-btn"
          @click="handleExportJson"
          :disabled="!currentReviewVersion"
          title="导出 JSON"
        >
          <span class="btn-icon">↧</span>
          JSON
        </button>
        <button
          class="action-btn"
          @click="handleExportReport"
          :disabled="!currentReviewVersion"
          title="打印报告"
        >
          <span class="btn-icon">⎙</span>
          报告
        </button>
        <button class="action-btn primary" @click="showCreateModal = true" title="新建版本">
          <span class="btn-icon">+</span>
          新版
        </button>
      </div>
    </div>

    <div class="view-tabs">
      <button
        class="tab-btn"
        :class="{ active: activeReviewTab === 'versions' }"
        @click="handleSwitchTab('versions')"
      >
        版本管理
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeReviewTab === 'comparison' }"
        @click="handleSwitchTab('comparison')"
      >
        对比视图
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeReviewTab === 'annotations' }"
        @click="handleSwitchTab('annotations')"
      >
        批注列表
      </button>
    </div>

    <div class="panel-content">
      <div v-if="activeReviewTab === 'versions'" class="versions-view">
        <div v-if="sortedReviewVersions.length === 0" class="empty-state">
          <div class="empty-icon">📋</div>
          <p class="empty-title">暂无打样版本</p>
          <p class="empty-hint">点击右上角"新版"按钮创建第一个打样版本</p>
        </div>

        <div v-else class="versions-list">
          <div
            v-for="version in sortedReviewVersions"
            :key="version.id"
            class="version-card"
            :class="{ active: currentReviewVersion?.id === version.id }"
            @click="handleSelectVersion(version.id)"
          >
            <div class="version-header">
              <div class="version-title">
                <span class="version-badge">V{{ version.versionNumber }}</span>
                <span class="version-name">{{ version.name }}</span>
              </div>
              <div
                class="status-badge"
                :style="{ backgroundColor: getStatusInfo(version.status).color }"
              >
                {{ getStatusInfo(version.status).label }}
              </div>
            </div>
            
            <div v-if="version.description" class="version-desc">
              {{ version.description }}
            </div>
            
            <div class="version-meta">
              <span class="meta-item">
                <span class="meta-label">负责人：</span>
                {{ version.assignee }}
              </span>
              <span class="meta-item">
                <span class="meta-label">批注：</span>
                {{ version.annotations.length }}
              </span>
            </div>
            
            <div class="version-footer">
              <span class="version-date">{{ formatDate(version.updatedAt) }}</span>
              <button
                class="delete-btn"
                @click.stop="handleDeleteVersion(version.id)"
                title="删除版本"
              >
                🗑
              </button>
            </div>
          </div>
        </div>

        <div v-if="currentReviewVersion" class="version-detail">
          <div class="detail-section">
            <h4 class="section-title">评审状态</h4>
            <div class="status-selector">
              <button
                v-for="opt in statusOptions"
                :key="opt.value"
                class="status-option"
                :class="{ active: currentReviewVersion.status === opt.value }"
                :style="currentReviewVersion.status === opt.value ? { backgroundColor: opt.color, borderColor: opt.color } : {}"
                @click="handleStatusChange(opt.value)"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>

          <div class="detail-section">
            <div class="section-header">
              <h4 class="section-title">评审结论</h4>
              <button class="edit-btn" @click="handleOpenConclusion">
                {{ currentReviewVersion.reviewConclusion ? '修改' : '添加' }}
              </button>
            </div>
            <div v-if="currentReviewVersion.reviewConclusion" class="conclusion-box">
              <p class="conclusion-text">{{ currentReviewVersion.reviewConclusion }}</p>
              <p class="conclusion-meta">
                评审人：{{ currentReviewVersion.reviewedBy || '未知' }}
                ·
                {{ formatDate(currentReviewVersion.reviewedAt || '') }}
              </p>
            </div>
            <p v-else class="empty-hint">暂无评审结论</p>
          </div>

          <div class="detail-section">
            <h4 class="section-title">基本参数</h4>
            <div class="params-grid">
              <div class="param-item">
                <span class="param-label">经线数量</span>
                <span class="param-value">{{ currentReviewVersion.snapshot.warpCount }} 根</span>
              </div>
              <div class="param-item">
                <span class="param-label">纬线循环</span>
                <span class="param-value">{{ currentReviewVersion.snapshot.weftCycle }} 行</span>
              </div>
              <div class="param-item">
                <span class="param-label">颜色数量</span>
                <span class="param-value">{{ currentReviewVersion.snapshot.colors.length }} 种</span>
              </div>
              <div class="param-item">
                <span class="param-label">图层数量</span>
                <span class="param-value">{{ currentReviewVersion.snapshot.layers.length }} 个</span>
              </div>
              <div class="param-item">
                <span class="param-label">建议重复</span>
                <span class="param-value">{{ currentReviewVersion.snapshot.suggestedRepeats }} 次</span>
              </div>
              <div class="param-item">
                <span class="param-label">排线步骤</span>
                <span class="param-value">{{ currentReviewVersion.snapshot.schedulingSteps.length }} 步</span>
              </div>
            </div>
          </div>

          <div class="detail-section">
            <h4 class="section-title">评审评论</h4>
            <div class="comments-list">
              <div
                v-for="comment in currentReviewVersion.comments"
                :key="comment.id"
                class="comment-item"
              >
                <div class="comment-header">
                  <span class="comment-author">{{ comment.author }}</span>
                  <span class="comment-date">{{ formatDate(comment.createdAt) }}</span>
                </div>
                <p class="comment-content">{{ comment.content }}</p>
              </div>
              <p v-if="currentReviewVersion.comments.length === 0" class="empty-hint">
                暂无评论
              </p>
            </div>
            <div class="add-comment">
              <input
                v-model="newComment"
                type="text"
                class="comment-input"
                placeholder="添加评论..."
                @keyup.enter="handleAddComment"
              />
              <button class="add-btn" @click="handleAddComment">发送</button>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="activeReviewTab === 'comparison'" class="comparison-view">
        <div v-if="sortedReviewVersions.length < 2" class="empty-state">
          <div class="empty-icon">🔍</div>
          <p class="empty-title">版本不足</p>
          <p class="empty-hint">请先创建至少两个打样版本以进行对比</p>
        </div>

        <template v-else>
          <div class="compare-selector">
            <div class="selector-group">
              <label class="selector-label">版本 A</label>
              <select
                class="version-select"
                :value="compareVersionIds?.[0] || ''"
                @change="e => handleSetCompareVersion(0, (e.target as HTMLSelectElement).value)"
              >
                <option v-for="v in sortedReviewVersions" :key="v.id" :value="v.id">
                  V{{ v.versionNumber }} - {{ v.name }}
                </option>
              </select>
            </div>
            <span class="vs-text">VS</span>
            <div class="selector-group">
              <label class="selector-label">版本 B</label>
              <select
                class="version-select"
                :value="compareVersionIds?.[1] || ''"
                @change="e => handleSetCompareVersion(1, (e.target as HTMLSelectElement).value)"
              >
                <option v-for="v in sortedReviewVersions" :key="v.id" :value="v.id">
                  V{{ v.versionNumber }} - {{ v.name }}
                </option>
              </select>
            </div>
            <button v-if="compareVersionIds" class="clear-btn" @click="handleClearCompare">
              清除
            </button>
          </div>

          <div v-if="!reviewComparisonResult" class="empty-state">
            <div class="empty-icon">📊</div>
            <p class="empty-title">选择两个版本开始对比</p>
          </div>

          <div v-else class="comparison-result">
            <div class="comparison-summary">
              <span class="summary-text">
                共发现 <strong>{{ reviewComparisonResult.totalChanges }}</strong> 处变更
              </span>
            </div>

            <div v-if="reviewComparisonResult.pattern.length > 0" class="diff-section">
              <h5 class="diff-title">基本参数变更</h5>
              <div class="diff-list">
                <div
                  v-for="item in reviewComparisonResult.pattern"
                  :key="item.key"
                  class="diff-item"
                  :class="item.type"
                >
                  <span class="diff-badge" :style="{ backgroundColor: getDiffTypeInfo(item.type).color }">
                    {{ getDiffTypeInfo(item.type).label }}
                  </span>
                  <span class="diff-key">{{ item.key === 'warpCount' ? '经线数量' : '纬线循环' }}</span>
                  <span class="diff-value">
                    {{ item.oldValue }} → {{ item.newValue }}
                  </span>
                </div>
              </div>
            </div>

            <div v-if="reviewComparisonResult.colors.length > 0" class="diff-section">
              <h5 class="diff-title">颜色方案变更 ({{ reviewComparisonResult.colors.length }})</h5>
              <div class="diff-list">
                <div
                  v-for="item in reviewComparisonResult.colors"
                  :key="item.key"
                  class="diff-item"
                  :class="item.type"
                >
                  <span class="diff-badge" :style="{ backgroundColor: getDiffTypeInfo(item.type).color }">
                    {{ getDiffTypeInfo(item.type).label }}
                  </span>
                  <div class="color-diff-content">
                    <template v-if="item.type === 'added'">
                      <div class="color-info">
                        <span class="color-dot" :style="{ backgroundColor: item.newValue?.value }"></span>
                        {{ item.newValue?.name }}
                      </div>
                    </template>
                    <template v-else-if="item.type === 'removed'">
                      <div class="color-info removed">
                        <span class="color-dot" :style="{ backgroundColor: item.oldValue?.value }"></span>
                        {{ item.oldValue?.name }}
                      </div>
                    </template>
                    <template v-else>
                      <div class="color-info">
                        <span class="color-dot" :style="{ backgroundColor: item.oldValue?.value }"></span>
                        {{ item.oldValue?.name }}
                      </div>
                      <span class="arrow">→</span>
                      <div class="color-info">
                        <span class="color-dot" :style="{ backgroundColor: item.newValue?.value }"></span>
                        {{ item.newValue?.name }}
                      </div>
                    </template>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="reviewComparisonResult.suggestedRepeats.type === 'modified'" class="diff-section">
              <h5 class="diff-title">重复次数建议</h5>
              <div class="diff-item modified">
                <span class="diff-badge" :style="{ backgroundColor: getDiffTypeInfo('modified').color }">修改</span>
                <span class="diff-key">建议重复次数</span>
                <span class="diff-value">
                  {{ reviewComparisonResult.suggestedRepeats.oldValue }} →
                  {{ reviewComparisonResult.suggestedRepeats.newValue }} 次
                </span>
              </div>
            </div>

            <div v-if="reviewComparisonResult.layers.length > 0" class="diff-section">
              <h5 class="diff-title">图层变更 ({{ reviewComparisonResult.layers.length }})</h5>
              <div class="diff-list">
                <div
                  v-for="item in reviewComparisonResult.layers"
                  :key="item.key"
                  class="diff-item"
                  :class="item.type"
                >
                  <span class="diff-badge" :style="{ backgroundColor: getDiffTypeInfo(item.type).color }">
                    {{ getDiffTypeInfo(item.type).label }}
                  </span>
                  <div class="layer-diff-content">
                    <template v-if="item.type === 'added'">
                      <span class="layer-name">{{ item.newValue?.layerName }}</span>
                      <span class="layer-cells">{{ item.newValue?.cellCount }} 格</span>
                    </template>
                    <template v-else-if="item.type === 'removed'">
                      <span class="layer-name removed">{{ item.oldValue?.layerName }}</span>
                      <span class="layer-cells">{{ item.oldValue?.cellCount }} 格</span>
                    </template>
                    <template v-else>
                      <span class="layer-name">{{ item.oldValue?.layerName }}</span>
                      <span class="layer-cells">
                        {{ item.oldValue?.cellCount }} → {{ item.newValue?.cellCount }} 格
                      </span>
                    </template>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="reviewComparisonResult.consumption.length > 0" class="diff-section">
              <h5 class="diff-title">消耗统计变更 ({{ reviewComparisonResult.consumption.length }})</h5>
              <div class="diff-list">
                <div
                  v-for="item in reviewComparisonResult.consumption"
                  :key="item.key"
                  class="diff-item"
                  :class="item.type"
                >
                  <span class="diff-badge" :style="{ backgroundColor: getDiffTypeInfo(item.type).color }">
                    {{ getDiffTypeInfo(item.type).label }}
                  </span>
                  <div class="consumption-diff">
                    <span class="color-dot" :style="{ backgroundColor: item.newValue?.colorValue || item.oldValue?.colorValue }"></span>
                    <span class="consumption-name">
                      {{ item.newValue?.colorName || item.oldValue?.colorName }}
                    </span>
                    <span class="consumption-value">
                      {{ item.oldValue?.count || 0 }} → {{ item.newValue?.count || 0 }} 次
                      ({{ ((item.newValue?.percentage || 0) * 100).toFixed(1) }}%)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="reviewComparisonResult.notes.length > 0" class="diff-section">
              <h5 class="diff-title">备注变更 ({{ reviewComparisonResult.notes.length }})</h5>
              <div class="diff-list">
                <div
                  v-for="(item, index) in reviewComparisonResult.notes"
                  :key="index"
                  class="diff-item note-diff"
                  :class="item.type"
                >
                  <span class="diff-badge" :style="{ backgroundColor: getDiffTypeInfo(item.type).color }">
                    {{ getDiffTypeInfo(item.type).label }}
                  </span>
                  <div class="note-diff-content">
                    <p v-if="item.oldValue" class="old-note">{{ item.oldValue }}</p>
                    <p v-if="item.newValue" class="new-note">{{ item.newValue }}</p>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="reviewComparisonResult.schedulingSteps.length > 0" class="diff-section">
              <h5 class="diff-title">排线步骤变更 ({{ reviewComparisonResult.schedulingSteps.length }})</h5>
              <div class="diff-list">
                <div
                  v-for="item in reviewComparisonResult.schedulingSteps.slice(0, 10)"
                  :key="item.key"
                  class="diff-item step-diff"
                  :class="item.type"
                >
                  <span class="diff-badge" :style="{ backgroundColor: getDiffTypeInfo(item.type).color }">
                    {{ getDiffTypeInfo(item.type).label }}
                  </span>
                  <div class="step-diff-content">
                    <div class="step-color">
                      <span class="color-dot" :style="{ backgroundColor: item.newValue?.colorValue || item.oldValue?.colorValue }"></span>
                      {{ item.newValue?.colorName || item.oldValue?.colorName }}
                    </div>
                    <span class="step-pos">
                      {{ item.newValue?.warpPositions.length || item.oldValue?.warpPositions.length }} 根经线
                    </span>
                  </div>
                </div>
                <p v-if="reviewComparisonResult.schedulingSteps.length > 10" class="more-hint">
                  还有 {{ reviewComparisonResult.schedulingSteps.length - 10 }} 处变更...
                </p>
              </div>
            </div>
          </div>
        </template>
      </div>

      <div v-else-if="activeReviewTab === 'annotations'" class="annotations-view">
        <div v-if="!currentReviewVersion" class="empty-state">
          <div class="empty-icon">💬</div>
          <p class="empty-title">请选择版本</p>
          <p class="empty-hint">选择一个打样版本查看批注</p>
        </div>

        <template v-else>
          <div class="annotations-stats">
            <div class="stat-card">
              <span class="stat-value">{{ currentReviewVersion.annotations.length }}</span>
              <span class="stat-label">总批注</span>
            </div>
            <div class="stat-card resolved">
              <span class="stat-value">{{ currentReviewVersion.annotations.filter(a => a.resolved).length }}</span>
              <span class="stat-label">已解决</span>
            </div>
            <div class="stat-card pending">
              <span class="stat-value">{{ currentReviewVersion.annotations.filter(a => !a.resolved).length }}</span>
              <span class="stat-label">待解决</span>
            </div>
          </div>

          <div v-if="currentReviewVersion.annotations.length === 0" class="empty-state">
            <div class="empty-icon">📝</div>
            <p class="empty-title">暂无批注</p>
            <p class="empty-hint">在工艺单或排线视图中添加批注</p>
          </div>

          <div v-else class="annotations-list">
            <div
              v-for="annotation in currentReviewVersion.annotations"
              :key="annotation.id"
              class="annotation-item"
              :class="{ resolved: annotation.resolved }"
            >
              <div class="annotation-header">
                <span class="annotation-target">
                  {{ getTargetTypeName(annotation.target.type) }}
                </span>
                <span
                  class="resolve-badge"
                  :class="{ resolved: annotation.resolved }"
                  @click="annotation.resolved ? handleUnresolveAnnotation(annotation.id) : handleResolveAnnotation(annotation.id)"
                >
                  {{ annotation.resolved ? '已解决' : '待解决' }}
                </span>
              </div>
              <p class="annotation-content">{{ annotation.content }}</p>
              <div class="annotation-footer">
                <span class="annotation-author">{{ annotation.author }}</span>
                <span class="annotation-date">{{ formatDate(annotation.createdAt) }}</span>
                <button class="delete-annotation" @click="handleDeleteAnnotation(annotation.id)">
                  删除
                </button>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
      <div class="modal-content">
        <h3 class="modal-title">创建打样版本</h3>
        <div class="form-group">
          <label class="form-label">版本名称</label>
          <input
            v-model="newVersionName"
            type="text"
            class="form-input"
            placeholder="输入版本名称"
          />
        </div>
        <div class="form-group">
          <label class="form-label">版本描述</label>
          <textarea
            v-model="newVersionDesc"
            class="form-textarea"
            placeholder="描述这个版本的特点（可选）"
            rows="3"
          ></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">负责人</label>
          <input
            v-model="newVersionAssignee"
            type="text"
            class="form-input"
            placeholder="输入负责人姓名"
          />
        </div>
        <div class="modal-actions">
          <button class="cancel-btn" @click="showCreateModal = false">取消</button>
          <button class="confirm-btn" @click="handleCreateVersion">创建</button>
        </div>
      </div>
    </div>

    <div v-if="showConclusionModal" class="modal-overlay" @click.self="showConclusionModal = false">
      <div class="modal-content">
        <h3 class="modal-title">编辑评审结论</h3>
        <div class="form-group">
          <label class="form-label">评审结论</label>
          <textarea
            v-model="conclusionText"
            class="form-textarea"
            placeholder="输入评审结论..."
            rows="5"
          ></textarea>
        </div>
        <div class="modal-actions">
          <button class="cancel-btn" @click="showConclusionModal = false">取消</button>
          <button class="confirm-btn" @click="handleSaveConclusion">保存</button>
        </div>
      </div>
    </div>

    <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="cancelDeleteVersion">
      <div class="modal-content">
        <h3 class="modal-title">确认删除</h3>
        <p class="confirm-text">确定要删除这个打样版本吗？此操作不可撤销。</p>
        <div class="modal-actions">
          <button class="cancel-btn" @click="cancelDeleteVersion">取消</button>
          <button class="confirm-btn danger" @click="confirmDeleteVersion">删除</button>
        </div>
      </div>
    </div>

    <div v-if="showDeleteAnnotationConfirm" class="modal-overlay" @click.self="cancelDeleteAnnotation">
      <div class="modal-content">
        <h3 class="modal-title">确认删除</h3>
        <p class="confirm-text">确定要删除这条批注吗？</p>
        <div class="modal-actions">
          <button class="cancel-btn" @click="cancelDeleteAnnotation">取消</button>
          <button class="confirm-btn danger" @click="confirmDeleteAnnotation">删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.review-panel {
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

      &:hover:not(:disabled) {
        background: #f5f0e6;
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

.panel-content {
  flex: 1;
  overflow-y: auto;
  max-height: 600px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  .empty-title {
    font-size: 16px;
    font-weight: 600;
    color: #3d2c1e;
    margin: 0 0 8px 0;
  }

  .empty-hint {
    font-size: 13px;
    color: #8b7355;
    margin: 0;
  }
}

.versions-view {
  padding: 16px 20px;
}

.versions-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
}

.version-card {
  padding: 14px;
  background: #faf7f2;
  border: 2px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #f5f0e6;
  }

  &.active {
    background: #fff5f2;
    border-color: #c84b31;
  }
}

.version-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.version-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.version-badge {
  padding: 2px 8px;
  background: #c84b31;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  border-radius: 4px;
}

.version-name {
  font-size: 14px;
  font-weight: 600;
  color: #3d2c1e;
}

.status-badge {
  padding: 3px 10px;
  color: #fff;
  font-size: 11px;
  font-weight: 500;
  border-radius: 12px;
}

.version-desc {
  font-size: 12px;
  color: #8b7355;
  margin-bottom: 8px;
  line-height: 1.5;
}

.version-meta {
  display: flex;
  gap: 16px;
  margin-bottom: 8px;

  .meta-item {
    font-size: 11px;
    color: #8b7355;

    .meta-label {
      color: #a08b72;
    }
  }
}

.version-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.version-date {
  font-size: 11px;
  color: #a08b72;
}

.delete-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  font-size: 14px;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.6;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 77, 79, 0.1);
    opacity: 1;
  }
}

.version-detail {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-top: 16px;
  border-top: 1px solid #f0ebe4;
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-header {
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

.edit-btn {
  padding: 4px 10px;
  border: 1px solid #e8e0d5;
  background: #fff;
  color: #c84b31;
  font-size: 12px;
  font-weight: 500;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #fff5f2;
    border-color: #c84b31;
  }
}

.status-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.status-option {
  padding: 6px 12px;
  border: 1px solid #e8e0d5;
  background: #fff;
  color: #6b5b47;
  font-size: 12px;
  font-weight: 500;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: #d4c8b8;
  }

  &.active {
    color: #fff;
    border-color: transparent;
  }
}

.conclusion-box {
  padding: 14px 16px;
  background: linear-gradient(135deg, #fff5f2 0%, #faf7f2 100%);
  border-radius: 8px;
  border: 1px solid #f5c1b3;
}

.conclusion-text {
  font-size: 13px;
  color: #3d2c1e;
  line-height: 1.6;
  margin: 0 0 8px 0;
}

.conclusion-meta {
  font-size: 11px;
  color: #8b7355;
  margin: 0;
}

.empty-hint {
  font-size: 12px;
  color: #a08b72;
  margin: 0;
  padding: 12px;
  text-align: center;
  background: #faf7f2;
  border-radius: 6px;
}

.params-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.param-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  background: #faf7f2;
  border-radius: 6px;

  .param-label {
    font-size: 11px;
    color: #8b7355;
  }

  .param-value {
    font-size: 14px;
    font-weight: 600;
    color: #3d2c1e;
  }
}

.comments-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.comment-item {
  padding: 10px 12px;
  background: #faf7f2;
  border-radius: 8px;
  border-left: 3px solid #e8e0d5;
}

.comment-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.comment-author {
  font-size: 12px;
  font-weight: 600;
  color: #c84b31;
}

.comment-date {
  font-size: 11px;
  color: #a08b72;
}

.comment-content {
  font-size: 13px;
  color: #555;
  line-height: 1.5;
  margin: 0;
}

.add-comment {
  display: flex;
  gap: 8px;

  .comment-input {
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
    padding: 0 16px;
    border: none;
    background: #c84b31;
    color: #fff;
    font-size: 13px;
    font-weight: 500;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      background: #d65842;
    }
  }
}

.comparison-view {
  padding: 16px 20px;
}

.compare-selector {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  margin-bottom: 20px;
  padding: 14px;
  background: #faf7f2;
  border-radius: 10px;
}

.selector-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.selector-label {
  font-size: 12px;
  font-weight: 500;
  color: #8b7355;
}

.version-select {
  height: 36px;
  padding: 0 10px;
  border: 1px solid #e8e0d5;
  border-radius: 6px;
  font-size: 13px;
  color: #3d2c1e;
  background: #fff;
  cursor: pointer;
  outline: none;

  &:focus {
    border-color: #c84b31;
  }
}

.vs-text {
  font-size: 14px;
  font-weight: 700;
  color: #c84b31;
  padding-bottom: 6px;
}

.clear-btn {
  height: 36px;
  padding: 0 12px;
  border: 1px solid #e8e0d5;
  background: #fff;
  color: #8b7355;
  font-size: 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    color: #c84b31;
    border-color: #c84b31;
  }
}

.comparison-summary {
  padding: 12px 16px;
  background: linear-gradient(135deg, #fff5f2 0%, #faf7f2 100%);
  border-radius: 8px;
  margin-bottom: 16px;
  border-left: 4px solid #c84b31;

  .summary-text {
    font-size: 13px;
    color: #555;

    strong {
      color: #c84b31;
      font-size: 16px;
    }
  }
}

.diff-section {
  margin-bottom: 16px;
}

.diff-title {
  font-size: 13px;
  font-weight: 600;
  color: #3d2c1e;
  margin: 0 0 8px 0;
  padding-bottom: 6px;
  border-bottom: 1px solid #f0ebe4;
}

.diff-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.diff-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: #faf7f2;
  border-radius: 6px;
  font-size: 12px;
  transition: all 0.2s ease;

  &.added {
    background: #f6ffed;
    border-left: 3px solid #52c41a;
  }

  &.removed {
    background: #fff2f0;
    border-left: 3px solid #ff4d4f;
  }

  &.modified {
    background: #fff7e6;
    border-left: 3px solid #fa8c16;
  }
}

.diff-badge {
  flex-shrink: 0;
  padding: 2px 8px;
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  border-radius: 4px;
}

.diff-key {
  flex-shrink: 0;
  width: 80px;
  color: #6b5b47;
  font-weight: 500;
}

.diff-value {
  flex: 1;
  color: #3d2c1e;
}

.color-diff-content {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.color-info {
  display: flex;
  align-items: center;
  gap: 6px;

  &.removed {
    text-decoration: line-through;
    opacity: 0.6;
  }
}

.color-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}

.arrow {
  color: #c84b31;
  font-weight: 600;
}

.layer-diff-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 1;
}

.layer-name {
  font-weight: 500;
  color: #3d2c1e;

  &.removed {
    text-decoration: line-through;
    opacity: 0.6;
  }
}

.layer-cells {
  color: #8b7355;
  font-size: 11px;
}

.consumption-diff {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.consumption-name {
  font-weight: 500;
  color: #3d2c1e;
}

.consumption-value {
  margin-left: auto;
  color: #6b5b47;
  font-size: 11px;
}

.note-diff-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.old-note,
.new-note {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
}

.old-note {
  color: #ff4d4f;
  text-decoration: line-through;
}

.new-note {
  color: #52c41a;
}

.more-hint {
  font-size: 11px;
  color: #a08b72;
  text-align: center;
  margin: 8px 0 0 0;
}

.step-diff-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 1;
}

.step-color {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  color: #3d2c1e;
}

.step-pos {
  color: #8b7355;
  font-size: 11px;
}

.annotations-view {
  padding: 16px 20px;
}

.annotations-stats {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}

.stat-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 14px 10px;
  background: #faf7f2;
  border-radius: 10px;

  &.resolved {
    background: #f6ffed;
  }

  &.pending {
    background: #fff7e6;
  }

  .stat-value {
    font-size: 24px;
    font-weight: 700;
    color: #c84b31;
  }

  .stat-label {
    font-size: 11px;
    color: #8b7355;
  }

  &.resolved .stat-value {
    color: #52c41a;
  }

  &.pending .stat-value {
    color: #fa8c16;
  }
}

.annotations-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.annotation-item {
  padding: 12px 14px;
  background: #faf7f2;
  border-radius: 8px;
  border-left: 3px solid #c84b31;
  transition: all 0.2s ease;

  &.resolved {
    opacity: 0.6;
    border-left-color: #52c41a;
  }
}

.annotation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.annotation-target {
  padding: 2px 8px;
  background: #fff;
  color: #c84b31;
  font-size: 11px;
  font-weight: 600;
  border-radius: 4px;
}

.resolve-badge {
  padding: 2px 10px;
  background: #fff2f0;
  color: #ff4d4f;
  font-size: 11px;
  font-weight: 500;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;

  &.resolved {
    background: #f6ffed;
    color: #52c41a;
  }

  &:hover {
    opacity: 0.8;
  }
}

.annotation-content {
  font-size: 13px;
  color: #3d2c1e;
  line-height: 1.6;
  margin: 0 0 10px 0;
}

.annotation-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 11px;
  color: #a08b72;
}

.annotation-author {
  font-weight: 500;
  color: #6b5b47;
}

.delete-annotation {
  margin-left: auto;
  padding: 2px 8px;
  border: none;
  background: transparent;
  color: #ff4d4f;
  font-size: 11px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 77, 79, 0.1);
  }
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
  max-width: 480px;
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: #3d2c1e;
  margin: 0 0 20px 0;
}

.form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #6b5b47;
  margin-bottom: 6px;
}

.form-input {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  border: 1px solid #e8e0d5;
  border-radius: 8px;
  font-size: 14px;
  color: #3d2c1e;
  background: #fff;
  outline: none;
  box-sizing: border-box;
  transition: all 0.2s ease;

  &:focus {
    border-color: #c84b31;
  }

  &::placeholder {
    color: #a08b72;
  }
}

.form-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e8e0d5;
  border-radius: 8px;
  font-size: 14px;
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
  margin-top: 24px;
}

.cancel-btn {
  padding: 8px 20px;
  border: 1px solid #e8e0d5;
  background: #fff;
  color: #6b5b47;
  font-size: 14px;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #faf7f2;
  }
}

.confirm-btn {
  padding: 8px 20px;
  border: none;
  background: #c84b31;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #d65842;
  }

  &.danger {
    background: #ff4d4f;

    &:hover {
      background: #ff7875;
    }
  }
}

.confirm-text {
  font-size: 14px;
  color: #555;
  line-height: 1.6;
  margin: 0 0 16px 0;
}
</style>

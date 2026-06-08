<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { usePatternStore } from '@/stores/pattern'
import { storeToRefs } from 'pinia'
import * as echarts from 'echarts/core'
import { PieChart, BarChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'

echarts.use([
  PieChart,
  BarChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  CanvasRenderer
])

const store = usePatternStore()
const { consumptionStats, filledCells, totalCells, layerConsumptions, layers, activeLayerId } = storeToRefs(store)

const chartType = ref<'pie' | 'bar'>('pie')
const viewMode = ref<'total' | 'layer'>('total')
const selectedLayerId = ref<string | null>(null)

watch(activeLayerId, (newId) => {
  if (viewMode.value === 'layer') {
    selectedLayerId.value = newId
  }
}, { immediate: true })

const currentStats = computed(() => {
  if (viewMode.value === 'total') {
    return consumptionStats.value
  }
  const layerConsumption = layerConsumptions.value.find(l => l.layerId === selectedLayerId.value)
  return layerConsumption?.stats || []
})

const currentFilledCells = computed(() => {
  return currentStats.value.reduce((sum, item) => sum + item.count, 0)
})

const pieOption = computed(() => {
  const data = currentStats.value
    .filter(item => item.count > 0)
    .map(item => ({
      name: item.colorName,
      value: item.count,
      itemStyle: { color: item.colorValue }
    }))

  return {
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        return `<div style="padding: 4px 8px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${params.color};"></span>
            <span style="font-weight: 600;">${params.name}</span>
          </div>
          <div style="font-size: 12px; color: #8b7355;">使用次数：<b>${params.value}</b> 次</div>
          <div style="font-size: 12px; color: #8b7355;">占比：<b>${(params.percent * 100).toFixed(1)}%</b></div>
        </div>`
      },
      backgroundColor: '#fff',
      borderColor: '#e8e0d5',
      borderWidth: 1,
      borderRadius: 8,
      padding: 0
    },
    series: [
      {
        name: '线材消耗',
        type: 'pie',
        radius: ['50%', '75%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 4,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold',
            color: '#3d2c1e'
          },
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.2)'
          }
        },
        labelLine: {
          show: false
        },
        data
      }
    ]
  }
})

const barOption = computed(() => {
  const data = currentStats.value.filter(item => item.count > 0)

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      },
      formatter: (params: any) => {
        const item = params[0]
        return `<div style="padding: 8px 12px;">
          <div style="font-weight: 600; margin-bottom: 4px;">${item.name}</div>
          <div style="font-size: 12px; color: #8b7355;">使用次数：<b>${item.value}</b> 次</div>
        </div>`
      },
      backgroundColor: '#fff',
      borderColor: '#e8e0d5',
      borderWidth: 1,
      borderRadius: 8
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: data.map(item => item.colorName),
      axisLabel: {
        color: '#6b5b47',
        fontSize: 12,
        rotate: data.length > 5 ? 30 : 0
      },
      axisLine: {
        lineStyle: { color: '#e8e0d5' }
      },
      axisTick: {
        show: false
      }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: '#8b7355',
        fontSize: 12
      },
      axisLine: {
        show: false
      },
      axisTick: {
        show: false
      },
      splitLine: {
        lineStyle: {
          color: '#f0ebe4',
          type: 'dashed'
        }
      }
    },
    series: [
      {
        type: 'bar',
        data: data.map(item => ({
          value: item.count,
          itemStyle: {
            color: item.colorValue,
            borderRadius: [4, 4, 0, 0]
          }
        })),
        barWidth: '50%',
        emphasis: {
          itemStyle: {
            shadowBlur: 8,
            shadowColor: 'rgba(0, 0, 0, 0.2)'
          }
        }
      }
    ]
  }
})

function switchChartType(type: 'pie' | 'bar') {
  chartType.value = type
}

function switchViewMode(mode: 'total' | 'layer') {
  viewMode.value = mode
  if (mode === 'layer') {
    selectedLayerId.value = activeLayerId.value
  }
}

function selectLayer(layerId: string) {
  selectedLayerId.value = layerId
}

function getLayerFilledCells(layerId: string): number {
  const layerConsumption = layerConsumptions.value.find(l => l.layerId === layerId)
  return layerConsumption?.stats.reduce((sum, item) => sum + item.count, 0) || 0
}
</script>

<template>
  <div class="consumption-chart">
    <div class="chart-header">
      <span class="title">线材消耗统计</span>
      <div class="chart-type-switch">
        <button
          class="switch-btn"
          :class="{ active: chartType === 'pie' }"
          @click="switchChartType('pie')"
        >
          饼图
        </button>
        <button
          class="switch-btn"
          :class="{ active: chartType === 'bar' }"
          @click="switchChartType('bar')"
        >
          柱图
        </button>
      </div>
    </div>

    <div class="view-mode-switch">
      <button
        class="view-btn"
        :class="{ active: viewMode === 'total' }"
        @click="switchViewMode('total')"
      >
        总消耗
      </button>
      <button
        class="view-btn"
        :class="{ active: viewMode === 'layer' }"
        @click="switchViewMode('layer')"
      >
        单图层
      </button>
    </div>

    <div v-if="viewMode === 'layer'" class="layer-selector">
      <div class="layer-selector-label">选择图层：</div>
      <div class="layer-options">
        <div
          v-for="layer in layers"
          :key="layer.id"
          class="layer-option"
          :class="{ active: selectedLayerId === layer.id }"
          @click="selectLayer(layer.id)"
        >
          <span class="layer-name">{{ layer.name }}</span>
          <span class="layer-count">{{ getLayerFilledCells(layer.id) }} 格</span>
        </div>
      </div>
    </div>

    <div class="chart-summary">
      <div class="summary-item">
        <span class="summary-label">总格数</span>
        <span class="summary-value">{{ totalCells }}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">已填充</span>
        <span class="summary-value filled">{{ currentFilledCells }}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">填充率</span>
        <span class="summary-value">{{ totalCells > 0 ? ((currentFilledCells / totalCells) * 100).toFixed(1) : 0 }}%</span>
      </div>
    </div>

    <div class="chart-container">
      <v-chart
        v-if="chartType === 'pie'"
        class="chart"
        :option="pieOption"
        autoresize
      />
      <v-chart
        v-else
        class="chart"
        :option="barOption"
        autoresize
      />
    </div>

    <div class="color-list">
      <div
        v-for="item in currentStats"
        :key="item.colorId"
        class="color-item"
      >
        <div class="color-info">
          <div
            class="color-dot"
            :style="{ backgroundColor: item.colorValue }"
          ></div>
          <span class="color-name">{{ item.colorName }}</span>
        </div>
        <div class="color-stats">
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
  </div>
</template>

<style lang="scss" scoped>
.consumption-chart {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(61, 44, 30, 0.08);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .title {
    font-size: 18px;
    font-weight: 600;
    color: #3d2c1e;
  }

  .chart-type-switch {
    display: flex;
    background: #f8f5f0;
    border-radius: 8px;
    padding: 3px;

    .switch-btn {
      padding: 6px 14px;
      border: none;
      background: transparent;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      color: #8b7355;
      cursor: pointer;
      transition: all 0.2s ease;

      &.active {
        background: #fff;
        color: #c84b31;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      }

      &:hover:not(.active) {
        color: #6b5b47;
      }
    }
  }
}

.view-mode-switch {
  display: flex;
  background: #faf7f2;
  border-radius: 8px;
  padding: 3px;

  .view-btn {
    flex: 1;
    padding: 8px 12px;
    border: none;
    background: transparent;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    color: #8b7355;
    cursor: pointer;
    transition: all 0.2s ease;

    &.active {
      background: #fff;
      color: #c84b31;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    &:hover:not(.active) {
      color: #6b5b47;
    }
  }
}

.layer-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .layer-selector-label {
    font-size: 12px;
    color: #8b7355;
    font-weight: 500;
  }

  .layer-options {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .layer-option {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: #faf7f2;
    border: 1px solid #e8e0d5;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      background: #f5f0e6;
    }

    &.active {
      background: #fff5f2;
      border-color: #c84b31;

      .layer-name {
        color: #c84b31;
      }
    }

    .layer-name {
      font-size: 12px;
      font-weight: 500;
      color: #6b5b47;
    }

    .layer-count {
      font-size: 11px;
      color: #a08b72;
    }
  }
}

.chart-summary {
  display: flex;
  gap: 10px;
  padding: 10px;
  background: #faf7f2;
  border-radius: 8px;

  .summary-item {
    flex: 1;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 4px;

    .summary-label {
      font-size: 11px;
      color: #8b7355;
    }

    .summary-value {
      font-size: 18px;
      font-weight: 700;
      color: #3d2c1e;

      &.filled {
        color: #c84b31;
      }
    }
  }
}

.chart-container {
  height: 200px;
  width: 100%;
}

.chart {
  width: 100%;
  height: 100%;
}

.color-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 180px;
  overflow-y: auto;
  padding-right: 4px;
}

.color-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 8px 10px;
  background: #faf7f2;
  border-radius: 8px;
  transition: all 0.2s ease;

  &:hover {
    background: #f5f0e6;
  }

  .color-info {
    display: flex;
    align-items: center;
    gap: 8px;

    .color-dot {
      width: 14px;
      height: 14px;
      border-radius: 4px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
      flex-shrink: 0;
    }

    .color-name {
      font-size: 12px;
      font-weight: 600;
      color: #3d2c1e;
      flex: 1;
    }
  }

  .color-stats {
    display: flex;
    justify-content: space-between;
    font-size: 11px;

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
    height: 3px;
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
</style>

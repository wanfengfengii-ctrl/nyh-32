<script setup lang="ts">
import { NConfigProvider, NMessageProvider, darkTheme, zhCN, dateZhCN } from 'naive-ui'
import { ref, computed } from 'vue'
import HeaderBar from '@/components/HeaderBar.vue'
import SettingsPanel from '@/components/SettingsPanel.vue'
import BeatGridEditor from '@/components/BeatGridEditor.vue'
import PatternPreview from '@/components/PatternPreview.vue'
import ConsumptionChart from '@/components/ConsumptionChart.vue'
import LayerPanel from '@/components/LayerPanel.vue'
import ProcessSheetPanel from '@/components/ProcessSheetPanel.vue'
import SchedulingView from '@/components/SchedulingView.vue'

const theme = computed(() => undefined)

type RightPanelTab = 'preview' | 'process' | 'scheduling'
const activeRightTab = ref<RightPanelTab>('preview')

function switchRightTab(tab: RightPanelTab) {
  activeRightTab.value = tab
}
</script>

<template>
  <NConfigProvider :theme="theme" :locale="zhCN" :date-locale="dateZhCN">
    <NMessageProvider>
      <div class="app-container">
        <HeaderBar />
        
        <main class="main-content">
          <div class="content-wrapper">
            <aside class="left-panel">
              <LayerPanel />
              <SettingsPanel />
            </aside>

            <section class="center-panel">
              <BeatGridEditor />
            </section>

            <aside class="right-panel">
              <div class="right-panel-tabs">
                <button
                  class="tab-btn"
                  :class="{ active: activeRightTab === 'preview' }"
                  @click="switchRightTab('preview')"
                >
                  <span class="tab-icon">👁</span>
                  预览消耗
                </button>
                <button
                  class="tab-btn"
                  :class="{ active: activeRightTab === 'process' }"
                  @click="switchRightTab('process')"
                >
                  <span class="tab-icon">📋</span>
                  工艺单
                </button>
                <button
                  class="tab-btn"
                  :class="{ active: activeRightTab === 'scheduling' }"
                  @click="switchRightTab('scheduling')"
                >
                  <span class="tab-icon">🧵</span>
                  生产排线
                </button>
              </div>

              <div class="right-panel-content">
                <div v-show="activeRightTab === 'preview'" class="tab-content">
                  <PatternPreview />
                  <ConsumptionChart />
                </div>
                <div v-show="activeRightTab === 'process'" class="tab-content">
                  <ProcessSheetPanel />
                </div>
                <div v-show="activeRightTab === 'scheduling'" class="tab-content">
                  <SchedulingView />
                </div>
              </div>
            </aside>
          </div>
        </main>

        <footer class="app-footer">
          <p>© 2024 织带纹样设计器 · 为手工织带工作室量身打造</p>
        </footer>
      </div>
    </NMessageProvider>
  </NConfigProvider>
</template>

<style lang="scss" scoped>
.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #faf7f2;
}

.main-content {
  flex: 1;
  padding: 24px;
  max-width: 1800px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
}

.content-wrapper {
  display: grid;
  grid-template-columns: 280px 1fr 340px;
  gap: 20px;
  align-items: start;
}

.left-panel {
  position: sticky;
  top: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.center-panel {
  min-width: 0;
}

.right-panel {
  display: flex;
  flex-direction: column;
  gap: 0;
  position: sticky;
  top: 24px;

  .right-panel-tabs {
    display: flex;
    background: #fff;
    border-radius: 12px 12px 0 0;
    padding: 6px;
    box-shadow: 0 2px 8px rgba(61, 44, 30, 0.06);
    border-bottom: 1px solid #f0ebe4;
    position: relative;
    z-index: 1;

    .tab-btn {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      padding: 8px 4px;
      border: none;
      background: transparent;
      color: #8b7355;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      border-radius: 8px;
      transition: all 0.2s ease;

      .tab-icon {
        font-size: 18px;
      }

      &:hover {
        color: #6b5b47;
        background: #faf7f2;
      }

      &.active {
        background: #fff5f2;
        color: #c84b31;
        font-weight: 600;
      }
    }
  }

  .right-panel-content {
    .tab-content {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding-top: 16px;
    }
  }
}

.app-footer {
  text-align: center;
  padding: 20px;
  color: #a08b72;
  font-size: 12px;
  border-top: 1px solid #e8e0d5;
  background: #fff;

  p {
    margin: 0;
  }
}

@media (max-width: 1440px) {
  .content-wrapper {
    grid-template-columns: 260px 1fr 320px;
    gap: 16px;
  }
}

@media (max-width: 1280px) {
  .content-wrapper {
    grid-template-columns: 240px 1fr 280px;
    gap: 16px;
  }
}

@media (max-width: 1024px) {
  .content-wrapper {
    grid-template-columns: 1fr;
  }

  .left-panel,
  .right-panel {
    position: static;
  }

  .right-panel {
    .right-panel-content {
      .tab-content {
        flex-direction: column;

        > * {
          min-width: 280px;
        }
      }
    }
  }
}
</style>

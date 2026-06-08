<script setup lang="ts">
import { NConfigProvider, NMessageProvider, darkTheme, zhCN, dateZhCN } from 'naive-ui'
import { computed } from 'vue'
import HeaderBar from '@/components/HeaderBar.vue'
import SettingsPanel from '@/components/SettingsPanel.vue'
import BeatGridEditor from '@/components/BeatGridEditor.vue'
import PatternPreview from '@/components/PatternPreview.vue'
import ConsumptionChart from '@/components/ConsumptionChart.vue'

const theme = computed(() => undefined)
</script>

<template>
  <NConfigProvider :theme="theme" :locale="zhCN" :date-locale="dateZhCN">
    <NMessageProvider>
      <div class="app-container">
        <HeaderBar />
        
        <main class="main-content">
          <div class="content-wrapper">
            <aside class="left-panel">
              <SettingsPanel />
            </aside>

            <section class="center-panel">
              <BeatGridEditor />
            </section>

            <aside class="right-panel">
              <PatternPreview />
              <ConsumptionChart />
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
  max-width: 1600px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
}

.content-wrapper {
  display: grid;
  grid-template-columns: 260px 1fr 320px;
  gap: 20px;
  align-items: start;
}

.left-panel {
  position: sticky;
  top: 24px;
}

.center-panel {
  min-width: 0;
}

.right-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  position: sticky;
  top: 24px;
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
    flex-direction: row;
    flex-wrap: wrap;

    > * {
      flex: 1;
      min-width: 280px;
    }
  }
}
</style>

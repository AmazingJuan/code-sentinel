<!-- apps/frontend/src/views/ScansView.vue -->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ScanService } from '@/services/ScanService'
import type { ScanFiltersInterface, ScanInterface } from '@/interfaces/ScanInterface'
import StatusBadge from '@/components/StatusBadge.vue'
import ScanFilterBar from '@/components/ScanFilterBar.vue'

const scans = ref<ScanInterface[]>([])
const filters = ref<ScanFiltersInterface>({})
const loading = ref<boolean>(false)

async function loadScans(): Promise<void> {
  loading.value = true
  scans.value = await ScanService.getScans(filters.value)
  loading.value = false
}

onMounted(loadScans)
</script>

<template>
  <div class="p-6">
    <ScanFilterBar v-model="filters" @apply="loadScans" />

    <p class="mt-4 text-sm text-gray-400">{{ scans.length }} scans</p>

    <table class="mt-2 w-full text-left">
      <thead class="text-xs text-gray-400">
        <tr>
          <th>SCAN</th>
          <th>PROJECT</th>
          <th>DATE</th>
          <th>STATUS</th>
          <th>TOOLS</th>
          <th>CRIT</th>
          <th>HIGH</th>
          <th>MED</th>
          <th>LOW</th>
          <th>TOTAL</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="scan in scans" :key="scan.id" class="border-t border-gray-800">
          <td>
            <RouterLink :to="{ name: 'scan.show', params: { id: scan.id } }" class="text-green-400">
              #{{ scan.scanNumber }}
            </RouterLink>
          </td>
          <td>{{ scan.project.name }}</td>
          <td>{{ new Date(scan.date).toLocaleDateString() }}</td>
          <td><StatusBadge :status="scan.status" /></td>
          <td>
            <span v-for="tool in scan.tools" :key="tool" class="mr-1 rounded bg-gray-800 px-1 text-xs">
              {{ tool }}
            </span>
          </td>
          <td>{{ scan.criticalCount }}</td>
          <td>{{ scan.highCount }}</td>
          <td>{{ scan.mediumCount }}</td>
          <td>{{ scan.lowCount }}</td>
          <td>{{ scan.totalCount }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
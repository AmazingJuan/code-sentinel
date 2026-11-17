<!-- apps/frontend/src/views/FindingsView.vue -->
<script setup lang="ts">
import { ChevronRight, Search } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

import FindingFilterBar from '@/components/FindingFilterBar.vue'
import PageHeader from '@/components/PageHeader.vue'
import SeverityBadge from '@/components/SeverityBadge.vue'
import type { FindingFiltersInterface } from '@/interfaces/FindingFiltersInterface'
import type { FindingInterface } from '@/interfaces/FindingInterface'
import { FindingService } from '@/services/FindingService'

const findings = ref<FindingInterface[]>([])
const filters = ref<FindingFiltersInterface>({})
const searchQuery = ref('')
const errorMessage = ref<string | null>(null)

async function loadFindings(): Promise<void> {
  errorMessage.value = null
  try {
    findings.value = await FindingService.getFindings(filters.value)
  } catch {
    errorMessage.value = 'We could not load the findings.'
  }
}

const displayedFindings = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return findings.value

  return findings.value.filter((f) => {
    return (
      f.type.toLowerCase().includes(query) ||
      (f.cwe && f.cwe.toLowerCase().includes(query)) ||
      (f.filePath && f.filePath.toLowerCase().includes(query)) ||
      f.sourceTool.toLowerCase().includes(query) ||
      (f.description && f.description.toLowerCase().includes(query))
    )
  })
})

onMounted(loadFindings)
</script>

<template>
  <div class="p-5 sm:p-8">
    <PageHeader
      title="Findings"
      breadcrumb="~/ findings"
      description="Aggregated vulnerabilities and security defects from analysis scans."
    />

    <!-- Filter & Search Toolbar -->
    <div class="mb-5 space-y-3 rounded-lg border border-border bg-card p-4">
      <div class="relative">
        <Search class="absolute left-3 top-2.5 size-4 text-muted-foreground" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Filter findings by type, CWE, file path, or source tool..."
          class="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <FindingFilterBar v-model="filters" @apply="loadFindings" />
    </div>

    <p
      v-if="errorMessage"
      role="alert"
      class="mt-5 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive"
    >
      {{ errorMessage }}
    </p>

    <!-- Table -->
    <div class="overflow-x-auto rounded-lg border border-border bg-card">
      <table class="w-full min-w-[760px] text-left text-sm">
        <thead class="border-b border-border bg-muted/30 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <tr>
            <th scope="col" class="px-4 py-3 font-medium">Severity</th>
            <th scope="col" class="px-4 py-3 font-medium">Finding Type</th>
            <th scope="col" class="px-4 py-3 font-medium">File / Path</th>
            <th scope="col" class="px-4 py-3 font-medium">Line</th>
            <th scope="col" class="px-4 py-3 font-medium">Tool</th>
            <th scope="col" class="px-4 py-3 font-medium">Status</th>
            <th scope="col" class="px-2 py-3"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <RouterLink
            v-for="finding in displayedFindings"
            :key="finding.id"
            :to="{ name: 'finding.show', params: { id: finding.id } }"
            custom
            v-slot="{ navigate }"
          >
            <tr
              class="group cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-accent/40"
              @click="navigate"
            >
              <td class="px-4 py-3"><SeverityBadge :severity="finding.severity" /></td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-foreground transition-colors group-hover:text-primary">
                    {{ finding.type }}
                  </span>
                  <span
                    v-if="finding.cwe"
                    class="rounded border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                  >
                    {{ finding.cwe }}
                  </span>
                </div>
              </td>
              <td class="px-4 py-3 font-mono text-xs text-term-cyan">{{ finding.filePath ?? '-' }}</td>
              <td class="px-4 py-3 font-mono text-muted-foreground">{{ finding.line ?? '-' }}</td>
              <td class="px-4 py-3 text-muted-foreground">{{ finding.sourceTool }}</td>
              <td class="px-4 py-3">
                <span class="inline-flex items-center gap-1.5 rounded-full border border-high/30 bg-high/15 px-2.5 py-0.5 text-xs font-medium text-high">
                  <span class="size-1.5 rounded-full bg-high" aria-hidden="true" />
                  Open
                </span>
              </td>
              <td class="px-2 py-3 text-muted-foreground">
                <ChevronRight class="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
              </td>
            </tr>
          </RouterLink>
        </tbody>
      </table>
      <p v-if="displayedFindings.length === 0" class="px-4 py-12 text-center text-sm text-muted-foreground">
        No findings match the selected filters or search query.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Activity,
  AlertTriangle,
  Bug,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FolderKanban,
  Info,
  Settings2,
  ShieldAlert,
} from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import ErrorState from '@/components/ErrorState.vue'
import LoadingState from '@/components/LoadingState.vue'
import ProjectAssignmentsPanel from '@/components/ProjectAssignmentsPanel.vue'
import SeverityBadge from '@/components/SeverityBadge.vue'
import SeverityBar from '@/components/SeverityBar.vue'
import StatCard from '@/components/StatCard.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import type { FindingInterface } from '@/interfaces/FindingInterface'
import type { ProjectAssignment } from '@/interfaces/ProjectAssignmentInterface'
import type { ProjectInterface, ProjectStatus } from '@/interfaces/ProjectInterface'
import { SCAN_TOOLS, type ScanInterface, type ScanTool } from '@/interfaces/ScanInterface'
import type { SeverityCounts } from '@/interfaces/SeverityCountsInterface'
import type { ManagedUser } from '@/interfaces/UserInterface'
import { AuthService } from '@/services/AuthService'
import { extractErrorMessage } from '@/services/ErrorHelper'
import { FindingService } from '@/services/FindingService'
import { formatDate } from '@/services/FormatHelper'
import { formatCommitSha, parseWebRepoUrl } from '@/services/GitHelper'
import { ProjectService } from '@/services/ProjectService'
import { ScanService } from '@/services/ScanService'
import { UserService } from '@/services/UserService'
import { getToastStore } from '@/stores/toastStore'

const CLI_SCAN_COMMAND = 'npx @amazingwalin/code-sentinel-cli scan'
const FORBIDDEN_MESSAGE = 'You do not have access to this project.'

const STATUS_LABELS: Record<ProjectStatus, string> = {
  pending: 'Pending scan',
  completed: 'Completed',
  failed: 'Failed',
}

const route = useRoute()
const toastStore = getToastStore()
const project = ref<ProjectInterface | null>(null)
const scans = ref<ScanInterface[]>([])
const findings = ref<FindingInterface[]>([])

const isLoading = ref<boolean>(false)
const isSaving = ref<boolean>(false)
const errorMessage = ref<string | null>(null)
const formErrorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const form = ref<{ repo: string; tools: ScanTool[] }>({ repo: '', tools: [] })

const isAdmin = computed<boolean>(() => AuthService.getUser()?.role === 'admin')

const assignments = ref<ProjectAssignment[]>([])
const allUsers = ref<ManagedUser[]>([])
const isLoadingAssignments = ref<boolean>(false)
const isSavingAssignment = ref<boolean>(false)
const assignmentErrorMessage = ref<string | null>(null)

const availableUsers = computed<ManagedUser[]>(() => {
  const assignedUserIds = new Set(assignments.value.map((assignment) => assignment.userId))
  return allUsers.value.filter((user) => !assignedUserIds.has(user.id))
})

const counts = computed<SeverityCounts>(() => ({
  critical: project.value?.criticalCount ?? 0,
  high: project.value?.highCount ?? 0,
  medium: project.value?.mediumCount ?? 0,
  low: project.value?.lowCount ?? 0,
}))

const totalFindingsCount = computed<number>(
  () => counts.value.critical + counts.value.high + counts.value.medium + counts.value.low,
)

// Only http(s) URLs are rendered as links so a crafted repo value cannot inject a javascript: URL.
const repoWebUrl = computed<string | null>(() => parseWebRepoUrl(project.value?.repo))

const recentScans = computed<ScanInterface[]>(() => scans.value.slice(0, 5))
const topFindings = computed<FindingInterface[]>(() =>
  findings.value
    .filter((finding) => finding.severity === 'critical' || finding.severity === 'high')
    .slice(0, 5),
)

function errorText(error: unknown, fallback: string): string {
  return extractErrorMessage(error, fallback, { forbidden: FORBIDDEN_MESSAGE })
}

let loadSequence = 0

async function loadProjectData(id: string): Promise<void> {
  const sequence = ++loadSequence
  isLoading.value = true
  errorMessage.value = null
  formErrorMessage.value = null
  successMessage.value = null

  try {
    const loadedProject = await ProjectService.getProjectById(id)
    // Scans and findings are secondary panels; their failure must not hide the project.
    const [projectScans, allFindings] = await Promise.all([
      ScanService.getScans({ projectId: id }).catch((): ScanInterface[] => []),
      FindingService.getFindings().catch((): FindingInterface[] => []),
    ])
    if (sequence !== loadSequence) return

    project.value = loadedProject
    form.value = { repo: loadedProject.repo, tools: [...loadedProject.tools] }
    scans.value = projectScans
    const scanIds = new Set(projectScans.map((scan) => scan.id))
    findings.value = allFindings.filter(
      (finding) =>
        scanIds.has(finding.scanId) ||
        finding.scan?.projectId === id ||
        finding.scan?.project?.id === id,
    )

    if (isAdmin.value) {
      await loadAssignments()
    }
  } catch (error) {
    if (sequence !== loadSequence) return
    project.value = null
    errorMessage.value = errorText(error, 'We could not load this project.')
  } finally {
    if (sequence === loadSequence) isLoading.value = false
  }
}

function reload(): void {
  void loadProjectData(String(route.params.id))
}

async function loadAssignments(): Promise<void> {
  if (!project.value) return
  isLoadingAssignments.value = true
  assignmentErrorMessage.value = null
  try {
    const [projectAssignments, users] = await Promise.all([
      ProjectService.getAssignments(project.value.id),
      allUsers.value.length > 0 ? Promise.resolve(allUsers.value) : UserService.findAll(),
    ])
    assignments.value = projectAssignments
    allUsers.value = users
  } catch (error) {
    assignmentErrorMessage.value = errorText(error, 'We could not load the project assignments.')
  } finally {
    isLoadingAssignments.value = false
  }
}

async function assignUser(userId: string): Promise<void> {
  if (!project.value) return
  isSavingAssignment.value = true
  assignmentErrorMessage.value = null
  try {
    const assignment = await ProjectService.assignUser(project.value.id, userId)
    assignments.value = [...assignments.value, assignment]
  } catch (error) {
    assignmentErrorMessage.value = errorText(error, 'We could not assign this user.')
  } finally {
    isSavingAssignment.value = false
  }
}

async function unassignUser(userId: string): Promise<void> {
  if (!project.value) return
  isSavingAssignment.value = true
  assignmentErrorMessage.value = null
  try {
    await ProjectService.unassignUser(project.value.id, userId)
    assignments.value = assignments.value.filter((assignment) => assignment.userId !== userId)
  } catch (error) {
    assignmentErrorMessage.value = errorText(error, 'We could not remove this assignment.')
  } finally {
    isSavingAssignment.value = false
  }
}

function toggleTool(tool: ScanTool): void {
  const current = form.value.tools
  form.value.tools = current.includes(tool)
    ? current.filter((item) => item !== tool)
    : [...current, tool]
}

async function saveConfiguration(): Promise<void> {
  if (!project.value || isSaving.value) return
  formErrorMessage.value = null
  successMessage.value = null

  if (form.value.tools.length === 0) {
    formErrorMessage.value = 'Select at least one security tool.'
    return
  }

  isSaving.value = true
  try {
    project.value = await ProjectService.updateProject(project.value.id, {
      repo: form.value.repo.trim(),
      tools: form.value.tools,
    })
    form.value = { repo: project.value.repo, tools: [...project.value.tools] }
    successMessage.value = 'Configuration saved. These settings will be used for future scans.'
    toastStore.success('Configuration saved', 'These settings will be used for future scans.')
  } catch (error) {
    formErrorMessage.value = errorText(error, 'We could not save this configuration.')
  } finally {
    isSaving.value = false
  }
}

// The same view instance is reused when navigating between projects.
watch(
  () => route.params.id,
  (id: string | string[] | undefined): void => {
    if (id) void loadProjectData(String(id))
  },
  { immediate: true },
)
</script>

<template>
  <div class="p-5 sm:p-8">
    <RouterLink
      :to="{ name: 'project.index' }"
      class="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <ChevronLeft class="size-4" />
      Back to projects
    </RouterLink>

    <div v-if="errorMessage" class="mt-3">
      <ErrorState
        title="Project Unavailable"
        :message="errorMessage"
        @retry="reload"
      />
    </div>
    <div v-else-if="isLoading" class="mt-6">
      <LoadingState
        title="Loading project details..."
        description="Fetching repository configuration, scan execution logs, and team permissions..."
      />
    </div>

    <template v-else-if="project">
      <div class="mb-6 flex flex-col justify-between gap-4 border-b border-border pb-6 md:flex-row md:items-center">
        <div>
          <div class="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <FolderKanban class="size-3.5" />
            <span>~/ projects / {{ project.name }}</span>
          </div>
          <h1 class="mt-1 text-2xl font-bold tracking-tight text-foreground md:text-3xl">{{ project.name }}</h1>
          <div class="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span class="inline-flex items-center gap-1">
              <span class="size-1.5 rounded-full bg-primary" />
              Status: {{ STATUS_LABELS[project.status] }}
            </span>
            <span v-if="project.repo" class="inline-flex items-center gap-1 font-mono">
              <ExternalLink class="size-3 text-muted-foreground" />
              <a
                v-if="repoWebUrl"
                :href="repoWebUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="hover:text-primary hover:underline"
              >
                {{ project.repo }}
              </a>
              <span v-else>{{ project.repo }}</span>
            </span>
            <span v-if="project.lastScan">
              Last scan: {{ formatDate(project.lastScan) }}
            </span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <StatusBadge :status="project.status" />
        </div>
      </div>

      <div class="mb-8 space-y-6">
        <h2 class="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          PROJECT SECURITY POSTURE
        </h2>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatCard
            label="TOTAL FINDINGS"
            :value="totalFindingsCount"
            :icon="Bug"
            hint="Active project defects"
          />
          <StatCard
            label="CRITICAL"
            :value="counts.critical"
            :icon="ShieldAlert"
            hint="Immediate triage"
            tone="critical"
          />
          <StatCard
            label="HIGH"
            :value="counts.high"
            :icon="AlertTriangle"
            hint="Exploitable risks"
            tone="high"
          />
          <StatCard
            label="MEDIUM"
            :value="counts.medium"
            :icon="Info"
            hint="Hardening items"
          />
          <StatCard
            label="LOW"
            :value="counts.low"
            :icon="Activity"
            hint="Best practices"
          />
        </div>

        <div class="rounded-lg border border-border bg-card p-5">
          <div class="mb-3 flex items-center justify-between">
            <h3 class="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Vulnerability Distribution
            </h3>
            <span class="font-mono text-xs text-muted-foreground">
              {{ totalFindingsCount }} total issue{{ totalFindingsCount === 1 ? '' : 's' }}
            </span>
          </div>
          <SeverityBar :counts="counts" />
        </div>

        <div class="flex flex-col gap-3 rounded-lg border border-border bg-card/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div class="text-sm font-semibold text-foreground">Scan this project locally</div>
            <div class="text-xs text-muted-foreground">
              Run the analysis engine directly in your terminal to synchronize findings for this project.
            </div>
          </div>
          <div class="flex items-center gap-2 rounded border border-border bg-muted/60 px-3 py-1.5 font-mono text-xs text-foreground">
            <span class="font-bold text-primary">$</span>
            <code>{{ CLI_SCAN_COMMAND }}</code>
          </div>
        </div>

        <div class="grid gap-6 lg:grid-cols-2">
          <div class="rounded-lg border border-border bg-card">
            <div class="flex items-center justify-between border-b border-border px-5 py-4">
              <div class="flex items-center gap-2 font-semibold text-foreground">
                <Activity class="size-4 text-primary" />
                <span>Recent Scans</span>
              </div>
              <span class="font-mono text-xs text-muted-foreground">
                {{ scans.length }} total scan{{ scans.length === 1 ? '' : 's' }}
              </span>
            </div>

            <div v-if="scans.length === 0" class="p-8 text-center text-sm text-muted-foreground">
              No scans performed on this project yet.
            </div>

            <ul v-else class="divide-y divide-border">
              <li
                v-for="scan in recentScans"
                :key="scan.id"
                class="flex items-center justify-between p-4 transition-colors hover:bg-accent/40"
              >
                <div>
                  <RouterLink
                    :to="{ name: 'scan.show', params: { id: scan.id } }"
                    class="font-mono text-sm font-medium text-foreground hover:text-primary hover:underline"
                  >
                    #scan-{{ scan.scanNumber }}
                  </RouterLink>
                  <div class="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span v-if="scan.commitSha" class="font-mono text-term-cyan">
                      {{ formatCommitSha(scan.commitSha) }}
                    </span>
                    <span aria-hidden="true">•</span>
                    <span>{{ formatDate(scan.date) }}</span>
                  </div>
                </div>

                <div class="flex items-center gap-3">
                  <span class="font-mono text-xs font-semibold text-foreground">
                    {{ scan.totalCount }} finding{{ scan.totalCount === 1 ? '' : 's' }}
                  </span>
                  <StatusBadge :status="scan.status" />
                </div>
              </li>
            </ul>
          </div>

          <div class="rounded-lg border border-border bg-card">
            <div class="flex items-center justify-between border-b border-border px-5 py-4">
              <div class="flex items-center gap-2 font-semibold text-foreground">
                <ShieldAlert class="size-4 text-high" />
                <span>Priority Vulnerabilities</span>
              </div>
              <span class="font-mono text-xs text-muted-foreground">
                {{ findings.length }} finding{{ findings.length === 1 ? '' : 's' }}
              </span>
            </div>

            <div v-if="topFindings.length === 0" class="p-8 text-center text-sm text-muted-foreground">
              {{ findings.length === 0 ? 'No security findings recorded.' : 'No critical or high severity defects detected!' }}
            </div>

            <ul v-else class="divide-y divide-border">
              <li
                v-for="finding in topFindings"
                :key="finding.id"
                class="flex items-center justify-between p-4 transition-colors hover:bg-accent/40"
              >
                <div class="min-w-0 pr-3">
                  <RouterLink
                    :to="{ name: 'finding.show', params: { id: finding.id } }"
                    class="block truncate text-sm font-medium text-foreground hover:text-primary hover:underline"
                  >
                    {{ finding.type }}
                  </RouterLink>
                  <p class="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                    {{ finding.filePath ?? 'N/A' }}<span v-if="finding.line !== null">:{{ finding.line }}</span>
                  </p>
                </div>
                <div class="flex shrink-0 items-center gap-2">
                  <SeverityBadge :severity="finding.severity" />
                  <RouterLink
                    :to="{ name: 'finding.show', params: { id: finding.id } }"
                    class="text-muted-foreground hover:text-foreground"
                    :aria-label="`View finding ${finding.type}`"
                  >
                    <ChevronRight class="size-4" />
                  </RouterLink>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div class="mb-8 rounded-lg border border-border bg-card p-5">
        <div class="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Settings2 class="size-4 text-primary" />
          <span>Security analysis configuration</span>
        </div>

        <p v-if="formErrorMessage" role="alert" class="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {{ formErrorMessage }}
        </p>
        <p v-if="successMessage" role="status" class="mb-3 rounded-md border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-primary">
          {{ successMessage }}
        </p>

        <form class="grid gap-4" @submit.prevent="saveConfiguration">
          <div>
            <label for="project-repo" class="mb-1.5 block font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">SOURCE CODE LOCATION</label>
            <input
              id="project-repo"
              v-model="form.repo"
              required
              maxlength="500"
              class="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <p class="mb-1.5 font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">SECURITY TOOLS</p>
            <div class="flex flex-wrap gap-3">
              <label
                v-for="tool in SCAN_TOOLS"
                :key="tool"
                :for="`tool-${tool}`"
                class="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background/50 px-3 py-2 text-sm text-foreground hover:border-primary/50 transition-colors"
              >
                <input
                  :id="`tool-${tool}`"
                  type="checkbox"
                  :checked="form.tools.includes(tool)"
                  class="size-4 rounded accent-primary"
                  @change="toggleTool(tool)"
                />
                {{ tool }}
              </label>
            </div>
          </div>

          <div>
            <button
              type="submit"
              :disabled="isSaving"
              class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {{ isSaving ? 'Saving...' : 'Save configuration' }}
            </button>
          </div>
        </form>
      </div>

      <ProjectAssignmentsPanel
        v-if="isAdmin"
        :assignments="assignments"
        :available-users="availableUsers"
        :is-loading="isLoadingAssignments"
        :is-saving="isSavingAssignment"
        :error-message="assignmentErrorMessage"
        @assign="assignUser"
        @unassign="unassignUser"
      />
    </template>
  </div>
</template>

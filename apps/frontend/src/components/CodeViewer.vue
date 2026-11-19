<script setup lang="ts">
import { Check, Copy, FileCode2 } from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref } from 'vue'

import type { CodeRow } from '@/interfaces/CodeSnippetInterface'

const props = defineProps<{
  filePath?: string | null
  targetLine?: number | null
  codeSnippet?: string | CodeRow[] | null
}>()

const copied = ref<boolean>(false)
let copiedTimer: ReturnType<typeof setTimeout> | undefined

function splitPlainSnippet(snippet: string): CodeRow[] {
  return snippet.split('\n').map(
    (text: string, index: number): CodeRow => ({
      line: (props.targetLine ?? 1) + index,
      text,
      highlight: index === 0,
    }),
  )
}

// Snippets arrive either as JSON-encoded rows or as plain source text.
const parsedRows = computed<CodeRow[]>(() => {
  const snippet = props.codeSnippet
  if (!snippet) return []
  if (Array.isArray(snippet)) return snippet

  try {
    const parsed: unknown = JSON.parse(snippet)
    if (Array.isArray(parsed)) return parsed as CodeRow[]
  } catch {
    // Not JSON: fall back to plain source text.
  }
  return splitPlainSnippet(snippet)
})

async function copyFilePath(): Promise<void> {
  if (!props.filePath) return
  const textToCopy = props.targetLine ? `${props.filePath}:${props.targetLine}` : props.filePath
  try {
    await navigator.clipboard.writeText(textToCopy)
    copied.value = true
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout((): void => {
      copied.value = false
    }, 2000)
  } catch {
    // Clipboard access can be denied by the browser; copying is best-effort.
  }
}

onBeforeUnmount((): void => clearTimeout(copiedTimer))
</script>

<template>
  <div class="rounded-lg border border-border bg-card overflow-hidden">
    <div class="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5 text-xs">
      <div class="flex items-center gap-2 truncate font-mono">
        <FileCode2 class="size-4 shrink-0 text-muted-foreground" />
        <span class="truncate font-semibold text-term-cyan">{{ filePath ?? 'unknown-file' }}</span>
        <span v-if="targetLine" class="text-muted-foreground">:line {{ targetLine }}</span>
      </div>

      <button
        type="button"
        class="inline-flex items-center gap-1 rounded px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        title="Copy path and line"
        :disabled="!filePath"
        @click="copyFilePath"
      >
        <Check v-if="copied" class="size-3 text-emerald-500" />
        <Copy v-else class="size-3" />
        <span>{{ copied ? 'Copied' : 'Copy' }}</span>
      </button>
    </div>

    <div v-if="parsedRows.length > 0" class="overflow-x-auto bg-[oklch(0.13_0.01_260)] py-3 font-mono text-xs leading-relaxed">
      <div
        v-for="(row, index) in parsedRows"
        :key="`${index}-${row.line}`"
        class="flex px-3 transition-colors"
        :class="row.highlight ? 'bg-destructive/15 border-l-2 border-destructive' : 'hover:bg-muted/10'"
      >
        <span
          class="w-10 shrink-0 select-none pr-4 text-right tabular-nums"
          :class="row.highlight ? 'text-destructive font-bold' : 'text-muted-foreground/40'"
        >
          {{ row.line }}
        </span>
        <span
          class="whitespace-pre font-mono"
          :class="row.highlight ? 'text-destructive font-medium' : 'text-foreground/80'"
        >
          {{ row.text === '' ? '\u00A0' : row.text }}
        </span>
      </div>
    </div>

    <div v-else class="p-6 text-center text-xs text-muted-foreground">
      <p>Source code snippet not available for this finding.</p>
      <p v-if="filePath" class="mt-1 font-mono text-term-cyan">{{ filePath }}:{{ targetLine ?? 1 }}</p>
    </div>
  </div>
</template>


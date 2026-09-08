<script setup lang="ts">
import { computed } from 'vue'

type Tone =
  | 'default'
  | 'dim'
  | 'green'
  | 'cyan'
  | 'prompt'
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'bold'
  | 'rule'

type TermSegment = {
  text: string
  tone?: Tone
}

type TermLine = string | TermSegment[]

interface Props {
  title?: string
  lines: TermLine[]
  class?: string
  animate?: boolean
  showCursor?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: 'zsh — codesentinel',
  animate: true,
  showCursor: true,
})

const toneClass: Record<Tone, string> = {
  default: 'text-foreground/90',
  dim: 'text-term-dim',
  green: 'text-term-green',
  cyan: 'text-term-cyan',
  prompt: 'text-primary',
  critical: 'text-critical',
  high: 'text-high',
  medium: 'text-medium',
  low: 'text-low',
  bold: 'text-foreground font-semibold',
  rule: 'text-term-dim',
}

const terminalClass = computed(() => [
  'min-w-0 max-w-full overflow-hidden rounded-lg border border-border',
  'bg-[oklch(0.13_0.01_260)]',
  'shadow-xl shadow-black/40',
  props.class,
])

function getToneClass(tone?: Tone) {
  return toneClass[tone ?? 'default']
}
</script>

<template>
  <div :class="terminalClass">
    <!-- Terminal header -->
    <div
      class="flex items-center gap-2 border-b border-border/70
             bg-[oklch(0.16_0.01_260)] px-3 py-2"
    >
      <!-- Traffic lights -->
      <div class="flex gap-1.5" aria-hidden="true">
        <span class="size-3 rounded-full bg-[#ff5f57]" />
        <span class="size-3 rounded-full bg-[#febc2e]" />
        <span class="size-3 rounded-full bg-[#28c840]" />
      </div>

      <!-- Title -->
      <span
        class="ml-2 font-mono text-xs text-muted-foreground"
      >
        {{ props.title }}
      </span>
    </div>

    <!-- Terminal content -->
    <div class="min-w-0 max-w-full overflow-x-auto p-4">
      <pre class="m-0 font-mono text-[13px] leading-relaxed"><code><span
        v-for="(line, i) in props.lines"
        :key="i"
        class="block whitespace-pre"
        :class="{
          'animate-in fade-in slide-in-from-left-1 fill-mode-both': props.animate,
        }"
        :style="props.animate
          ? {
              animationDelay: `${i * 45}ms`,
              animationDuration: '260ms',
            }
          : undefined"
      ><template v-if="typeof line === 'string'"><span :class="toneClass.default">{{ line === '' ? '\u00A0' : line }}</span></template><template v-else-if="line.length === 0">&nbsp;</template><template v-else><span
          v-for="(segment, j) in line"
          :key="j"
          :class="getToneClass(segment.tone)"
        >{{ segment.text }}</span></template><span
          v-if="i === props.lines.length - 1 && props.showCursor"
          class="ml-0.5 inline-block h-3.5 w-2 translate-y-0.5 animate-pulse bg-primary"
          aria-hidden="true"
        /></span></code></pre>
    </div>
  </div>
</template>
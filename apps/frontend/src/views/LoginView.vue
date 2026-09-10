<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  Terminal,
  Eye,
  EyeOff,
  ArrowRight,
} from '@lucide/vue'
import TerminalWindow from '../components/TerminalWindow.vue'
import { AuthService } from '@/services/AuthService'

const showPassword = ref(false)

const email = ref('')
const password = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
const router = useRouter()

async function onSubmit(): Promise<void> {
  isLoading.value = true
  errorMessage.value = ''

  try {
    await AuthService.login(email.value, password.value)
    await router.push({ name: 'scan.index' })
  } catch (error) {
    errorMessage.value = AuthService.getErrorMessage(error)
  } finally {
    isLoading.value = false
  }
}

</script>

<template>
  <div class="grid min-h-screen min-w-0 lg:grid-cols-2">

    <!-- Left: auth form -->
    <div class="min-w-0 flex flex-col justify-center px-6 py-12 sm:px-12">
      <div class="mx-auto w-full max-w-sm">

        <!-- Logo -->
        <div class="mb-8 flex items-center gap-2.5">
          <div
            class="flex size-9 items-center justify-center rounded-md
                   bg-primary/15 ring-1 ring-primary/30"
          >
            <Terminal class="size-5 text-primary" />
          </div>

          <div class="leading-none">
            <span
              class="font-mono text-lg font-semibold tracking-tight"
            >
              code<span class="text-primary">sentinel</span>
            </span>

            <p
              class="mt-1 text-[11px] uppercase tracking-widest
                     text-muted-foreground"
            >
              Security Analysis Engine
            </p>
          </div>
        </div>

        <!-- Header -->
        <h1 class="text-xl font-semibold tracking-tight">
          Sign in to your console
        </h1>

        <p class="mt-1 text-sm text-muted-foreground">
          Review scan history and findings normalized by the Code Sentinel CLI.
        </p>

        <!-- Form -->
        <form
          @submit.prevent="onSubmit"
          class="mt-8 flex flex-col gap-4"
        >

          <!-- Email -->
          <div class="flex flex-col gap-1.5">
            <label
              for="email"
              class="text-sm font-medium"
            >
              Email
            </label>

            <input
              id="email"
              v-model="email"
              type="email"
              autocomplete="email"
              placeholder="you@company.com"
              required
              class="h-10 rounded-md border border-input
                     bg-card px-3 font-mono text-sm outline-none
                     transition-colors placeholder:text-muted-foreground
                     focus:border-primary/60 focus:ring-1
                     focus:ring-primary/40"
            />
          </div>

          <!-- Password -->
          <div class="flex flex-col gap-1.5">

            <div class="flex items-center justify-between">
              <label
                for="password"
                class="text-sm font-medium"
              >
                Password
              </label>

            </div>

            <div class="relative">
              <input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                required
                class="h-10 w-full rounded-md border border-input
                       bg-card px-3 pr-10 font-mono text-sm
                       outline-none transition-colors
                       focus:border-primary/60
                       focus:ring-1 focus:ring-primary/40"
              />

              <button
                type="button"
                @click="showPassword = !showPassword"
                class="absolute right-2 top-1/2
                       -translate-y-1/2 rounded p-1
                       text-muted-foreground
                       hover:text-foreground"
                :aria-label="
                  showPassword
                    ? 'Hide password'
                    : 'Show password'
                "
              >
                <EyeOff
                  v-if="showPassword"
                  class="size-4"
                />

                <Eye
                  v-else
                  class="size-4"
                />
              </button>
            </div>
          </div>

          <p
            v-if="errorMessage"
            role="alert"
            class="rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300"
          >
            {{ errorMessage }}
          </p>

          <!-- Submit -->
          <button
            type="submit"
            class="mt-2 flex h-10 w-full items-center
                   justify-center gap-2 rounded-md
                   bg-primary px-4 font-medium
                   text-primary-foreground
                   transition-opacity hover:opacity-90 disabled:cursor-not-allowed
                   disabled:opacity-60"
                 :disabled="isLoading"
          >
                 {{ isLoading ? 'Signing in…' : 'Sign In' }}

            <ArrowRight class="size-4" />
          </button>
        </form>

        <!-- Footer -->
        <p
          class="mt-8 text-center text-xs
                 text-muted-foreground"
        >
          Protected console · Scans run from the CLI, not the browser
        </p>

      </div>
    </div>

    <!-- Right: terminal showcase -->
    <div
      class="relative hidden min-w-0 items-center justify-center
             overflow-hidden border-l border-border
             bg-[oklch(0.14_0.01_260)] p-10 lg:flex"
    >

      <!-- Grid background -->
      <div
        class="pointer-events-none absolute inset-0 opacity-[0.04]"
        :style="{
          backgroundImage: `
            linear-gradient(to right, white 1px, transparent 1px),
            linear-gradient(to bottom, white 1px, transparent 1px)
          `,
          backgroundSize: '28px 28px'
        }"
        aria-hidden="true"
      />

      <div class="relative min-w-0 w-full max-w-lg">

        <TerminalWindow
          title="zsh — ~/projects/code-sentinel"
          :lines="[
            [
              { text: '$ ', tone: 'prompt' },
              {
                text: 'codesentinel scan ./code-sentinel',
                tone: 'default'
              }
            ],
            [],
            [
              {
                text: 'Code Sentinel v1.0.0',
                tone: 'bold'
              }
            ],
            [
              {
                text: 'Security Analysis Engine',
                tone: 'dim'
              }
            ],
            [],
            [
              {
                text: '[1/4] Running SAST analysis............... ',
                tone: 'default'
              },
              {
                text: 'OK',
                tone: 'green'
              }
            ],
            [
              {
                text: '[2/4] Scanning for hardcoded secrets...... ',
                tone: 'default'
              },
              {
                text: 'OK',
                tone: 'green'
              }
            ],
            [
              {
                text: '[3/4] Scanning open ports................. ',
                tone: 'default'
              },
              {
                text: 'OK',
                tone: 'green'
              }
            ],
            [
              {
                text: '[4/4] Normalizing findings................ ',
                tone: 'default'
              },
              {
                text: 'OK',
                tone: 'green'
              }
            ],
            [],
            [
              {
                text: 'CRITICAL    1',
                tone: 'critical'
              }
            ],
            [
              {
                text: 'HIGH        3',
                tone: 'high'
              }
            ],
            [
              {
                text: 'MEDIUM      5',
                tone: 'medium'
              }
            ],
            [
              {
                text: 'LOW         2',
                tone: 'low'
              }
            ],
            [],
            [
              {
                text: 'Report generated. ',
                tone: 'default'
              },
              {
                text: 'Scan ID: #1042',
                tone: 'cyan'
              }
            ]
          ]"
        />

        <p
          class="mt-6 max-w-md text-center text-sm
                 text-muted-foreground"
        >
          The CLI orchestrates SAST, secret scanning and port
          scanning, then normalizes findings into this console.
        </p>

      </div>
    </div>

  </div>
</template>

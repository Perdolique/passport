<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'

const { isLoggedIn } = useAuth()
const config = useRuntimeConfig()
</script>

<template>
  <main class="landing">
    <div class="landing__hero">
      <h1 class="landing__title">{{ config.public.appName }}</h1>
      <p class="landing__subtitle">Simple authentication for your apps</p>

      <div class="landing__actions">
        <NuxtLink v-if="isLoggedIn" to="/dashboard" class="btn btn--primary">
          Go to Dashboard
        </NuxtLink>

        <NuxtLink v-else to="/login" class="btn btn--primary">
          Get Started
        </NuxtLink>
      </div>
    </div>
  </main>
</template>

<style scoped>
.landing {
  display: grid;
  place-items: center;
  min-block-size: 100dvh;
  padding: var(--space-4);
}

.landing__hero {
  text-align: center;
  max-inline-size: 32rem;
}

.landing__title {
  font-size: clamp(2.5rem, 8vw, 4rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  margin-block-end: var(--space-2);
}

.landing__subtitle {
  font-size: 1.125rem;
  color: var(--text-muted);
  margin-block-end: var(--space-6);
}

.landing__actions {
  display: flex;
  gap: var(--space-3);
  justify-content: center;
}
</style>

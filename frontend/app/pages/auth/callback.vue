<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'

const { fetchSession } = useAuth()
const route = useRoute()

onMounted(async () => {
  // Refresh session after OAuth callback
  await fetchSession()

  // Redirect to requested page or dashboard
  const redirect = (route.query.redirect as string) || '/dashboard'
  navigateTo(redirect)
})
</script>

<template>
  <main class="callback">
    <div class="callback__loader">
      <div class="callback__spinner" aria-hidden="true"></div>
      <p>Completing sign in...</p>
    </div>
  </main>
</template>

<style scoped>
.callback {
  display: grid;
  place-items: center;
  min-block-size: 100dvh;
}

.callback__loader {
  text-align: center;
}

.callback__spinner {
  inline-size: 2rem;
  block-size: 2rem;
  margin-inline: auto;
  margin-block-end: var(--space-4);
  border: 3px solid var(--border);
  border-block-start-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

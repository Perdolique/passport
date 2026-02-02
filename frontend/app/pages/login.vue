<script setup lang="ts">
import { watchEffect } from 'vue'
import { navigateTo } from '#app'
import { useAuth } from '~/composables/use-auth'

const { isLoggedIn, isLoading, loginWithTwitch, loginAnonymous } = useAuth()

// Redirect if already logged in
watchEffect(() => {
  if (isLoggedIn.value) {
    navigateTo('/dashboard')
  }
})

async function handleAnonymous() {
  await loginAnonymous()
  navigateTo('/dashboard')
}
</script>

<template>
  <main class="login">
    <div class="login__card">
      <h1 class="login__title">Sign in</h1>
      <p class="login__subtitle">Choose how you want to continue</p>

      <div class="login__buttons">
        <button
          class="btn btn--twitch"
          :disabled="isLoading"
          @click="loginWithTwitch('/dashboard')"
        >
          <svg class="btn__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
          </svg>
          Continue with Twitch
        </button>

        <div class="login__divider">
          <span>or</span>
        </div>

        <button
          class="btn btn--secondary"
          :disabled="isLoading"
          @click="handleAnonymous"
        >
          Continue as Guest
        </button>
      </div>

      <NuxtLink to="/" class="login__back">← Back to home</NuxtLink>
    </div>
  </main>
</template>

<style scoped>
.login {
  display: grid;
  place-items: center;
  min-block-size: 100dvh;
  padding: var(--space-4);
}

.login__card {
  inline-size: 100%;
  max-inline-size: 24rem;
  padding: var(--space-6);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}

.login__title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-block-end: var(--space-1);
}

.login__subtitle {
  color: var(--text-muted);
  margin-block-end: var(--space-6);
}

.login__buttons {
  display: grid;
  gap: var(--space-3);
}

.login__divider {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  color: var(--text-muted);
  font-size: 0.875rem;

  &::before,
  &::after {
    content: '';
    flex: 1;
    block-size: 1px;
    background: var(--border);
  }
}

.login__back {
  display: block;
  margin-block-start: var(--space-4);
  text-align: center;
  color: var(--text-muted);
  text-decoration: none;

  &:hover {
    color: var(--text);
  }
}
</style>

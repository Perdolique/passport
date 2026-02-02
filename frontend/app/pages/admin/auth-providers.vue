<script setup lang="ts">
import { definePageMeta } from '#imports'
import { $fetch, FetchError } from 'ofetch'
import { onMounted, ref } from 'vue'

definePageMeta({
  middleware: 'admin',
  layout: 'admin',
})

interface AuthProvider {
  id: string
  name: string
  type: string
  isActive: boolean
}

const providers = ref<AuthProvider[]>([])
const loading = ref(true)
const errorMessage = ref<string | null>(null)

/**
 * Fetch list of auth providers from backend
 */
async function fetchProviders() {
  loading.value = true
  errorMessage.value = null

  try {
    const data = await $fetch<{ providers: AuthProvider[] }>(
      '/api/admin/auth-providers',
      {
        credentials: 'include',
      },
    )

    providers.value = data.providers
  }
  catch (error) {
    if (error instanceof FetchError) {
      errorMessage.value = error.data?.error || 'Failed to load providers'
    } else {
      errorMessage.value = 'Failed to load providers'
    }
  }
  finally {
    loading.value = false
  }
}

/**
 * Toggle provider active status
 */
async function toggleProvider(provider: AuthProvider) {
  const previousState = provider.isActive

  try {
    const data = await $fetch<{ provider: AuthProvider }>(
      `/api/admin/auth-providers/${provider.id}`,
      {
        method: 'PATCH',
        credentials: 'include',
        body: {
          isActive: !provider.isActive,
        },
      },
    )

    // Update local state
    provider.isActive = data.provider.isActive
  }
  catch (error) {
    // Revert on error
    provider.isActive = previousState

    if (error instanceof FetchError) {
      errorMessage.value = error.data?.error || 'Failed to update provider'
    } else {
      errorMessage.value = 'Failed to update provider'
    }
  }
}

// Fetch providers on mount
onMounted(() => {
  fetchProviders()
})
</script>

<template>
  <div class="auth-providers">
    <header class="page-header">
      <h1>Authentication Providers</h1>
      <p class="page-description">
        Manage OAuth providers and authentication methods for your application
      </p>
    </header>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      Loading providers...
    </div>

    <div v-else-if="errorMessage" class="error-state">
      <div class="error-icon">⚠️</div>
      <p class="error-message">{{ errorMessage }}</p>
      <button @click="fetchProviders" class="btn btn--primary">
        Retry
      </button>
    </div>

    <div v-else class="providers-grid">
      <div
        v-for="provider in providers"
        :key="provider.id"
        class="provider-card"
      >
        <div class="provider-card__header">
          <div class="provider-card__info">
            <h3 class="provider-card__name">{{ provider.name }}</h3>
            <span class="provider-card__type">{{ provider.type }}</span>
          </div>

          <label class="toggle-switch">
            <input
              type="checkbox"
              :checked="provider.isActive"
              @change="toggleProvider(provider)"
            >
            <span class="toggle-slider" />
          </label>
        </div>

        <div class="provider-card__status">
          <span
            class="status-badge"
            :class="{ 'status-badge--active': provider.isActive }"
          >
            {{ provider.isActive ? '✓ Active' : '✗ Inactive' }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-providers {
  max-inline-size: 60rem;
}

.page-header {
  margin-block-end: var(--space-6);

  & h1 {
    font-size: 1.75rem;
    font-weight: 700;
    margin-block-end: var(--space-2);
  }
}

.page-description {
  color: var(--text-muted);
  font-size: 0.9375rem;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-8);
  color: var(--text-muted);
}

.spinner {
  inline-size: 2rem;
  block-size: 2rem;
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

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-8);
  text-align: center;
}

.error-icon {
  font-size: 3rem;
}

.error-message {
  color: var(--error);
  font-weight: 500;
}

.providers-grid {
  display: grid;
  gap: var(--space-4);
}

.provider-card {
  padding: var(--space-5);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);

  &:hover {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px oklch(from var(--primary) l c h / 0.05);
  }
}

.provider-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
  margin-block-end: var(--space-3);
}

.provider-card__info {
  flex: 1;
}

.provider-card__name {
  font-size: 1.125rem;
  font-weight: 600;
  margin-block-end: var(--space-2);
}

.provider-card__type {
  display: inline-block;
  padding: var(--space-1) var(--space-2);
  background: var(--background);
  color: var(--text-muted);
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.provider-card__status {
  margin-block-start: var(--space-2);
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  background: var(--border);
  color: var(--text-muted);
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
  font-weight: 500;

  &--active {
    background: oklch(55% 0.2 145 / 0.15);
    color: oklch(45% 0.2 145);
  }
}

/* Toggle switch */
.toggle-switch {
  position: relative;
  display: inline-block;
  inline-size: 3rem;
  block-size: 1.75rem;
  flex-shrink: 0;
}

.toggle-switch input {
  opacity: 0;
  inline-size: 0;
  block-size: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background-color: var(--border);
  transition: background-color var(--transition-normal);
  border-radius: var(--radius-full);

  &::before {
    position: absolute;
    content: "";
    block-size: 1.25rem;
    inline-size: 1.25rem;
    inset-inline-start: 0.25rem;
    inset-block-end: 0.25rem;
    background-color: var(--surface);
    transition: transform var(--transition-normal);
    border-radius: 50%;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }
}

input:checked + .toggle-slider {
  background-color: var(--primary);
}

input:checked + .toggle-slider::before {
  transform: translateX(1.25rem);
}

input:focus + .toggle-slider {
  box-shadow: 0 0 0 3px oklch(from var(--primary) l c h / 0.2);
}
</style>


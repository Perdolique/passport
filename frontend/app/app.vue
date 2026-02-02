<script setup lang="ts">
import { navigateTo, useRoute } from '#app'
import { computed, onMounted } from 'vue'
import { useAuth } from '~/composables/use-auth'

const { user, isLoggedIn, isAdmin, fetchSession, logout } = useAuth()
const route = useRoute()

// Fetch session on app mount (client-side only for SSR)
onMounted(() => {
  fetchSession()
})

// Don't show header on login page or auth callback page
const showHeader = computed(() => route.path !== '/login' && !route.path.startsWith('/auth/'))

async function handleLogout() {
  await logout()
  navigateTo('/login')
}
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />

    <!-- Global Navigation Header -->
    <header v-if="showHeader && isLoggedIn" class="app-header">
      <div class="app-header__container">
        <NuxtLink to="/" class="app-header__logo">
          🔐 Passport
        </NuxtLink>

        <nav class="app-header__nav">
          <NuxtLink to="/dashboard" class="app-header__link">
            Dashboard
          </NuxtLink>
          <NuxtLink v-if="isAdmin" to="/admin/auth-providers" class="app-header__link">
            Admin Panel
          </NuxtLink>
        </nav>

        <div class="app-header__user">
          <div class="app-header__user-info">
            <img
              v-if="user?.twitchUser?.profileImageUrl"
              :src="user.twitchUser.profileImageUrl"
              :alt="user.twitchUser.displayName"
              class="app-header__avatar"
            />
            <div v-else class="app-header__avatar app-header__avatar--placeholder">
              👤
            </div>
            <span class="app-header__username">
              {{ user?.twitchUser?.displayName || 'Anonymous' }}
            </span>
          </div>

          <span class="app-header__role-badge" :class="{ 'app-header__role-badge--admin': isAdmin }">
            {{ isAdmin ? 'Admin' : 'User' }}
          </span>

          <button class="btn btn--ghost btn--sm" @click="handleLogout">
            Sign out
          </button>
        </div>
      </div>
    </header>

    <NuxtPage />
  </div>
</template>

<style scoped>
.app-header {
  background: var(--surface);
  border-block-end: 1px solid var(--border);
  padding-block: var(--space-3);
  position: sticky;
  inset-block-start: 0;
  z-index: 100;
}

.app-header__container {
  max-inline-size: 80rem;
  margin-inline: auto;
  padding-inline: var(--space-4);
  display: flex;
  align-items: center;
  gap: var(--space-6);
}

.app-header__logo {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text);
  transition: color var(--transition-fast);

  &:hover {
    color: var(--primary);
  }
}

.app-header__nav {
  display: flex;
  gap: var(--space-1);
  margin-inline-start: auto;
}

.app-header__link {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  color: var(--text-muted);
  font-weight: 500;
  font-size: 0.9375rem;
  transition:
    color var(--transition-fast),
    background-color var(--transition-fast);

  &:hover {
    color: var(--text);
    background-color: var(--background);
  }

  &.router-link-active {
    color: var(--primary);
    background-color: oklch(from var(--primary) l c h / 0.1);
  }
}

.app-header__user {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.app-header__user-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.app-header__avatar {
  inline-size: 2rem;
  block-size: 2rem;
  border-radius: 50%;
  object-fit: cover;

  &--placeholder {
    display: grid;
    place-items: center;
    background: var(--border);
    font-size: 1rem;
  }
}

.app-header__username {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text);
}

.app-header__role-badge {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.025em;
  background: var(--border);
  color: var(--text-muted);

  &--admin {
    background: oklch(55% 0.2 25 / 0.15);
    color: oklch(45% 0.2 25);
  }
}

.btn--sm {
  padding: var(--space-2) var(--space-3);
  font-size: 0.875rem;
}
</style>

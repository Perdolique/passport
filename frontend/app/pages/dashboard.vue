<script setup lang="ts">
  import { definePageMeta } from '#imports';
  import { useAuth } from '~/composables/use-auth'

  definePageMeta({
    middleware: 'auth',
  })

  const { user, isAdmin, isLoading, linkTwitch } = useAuth()
</script>

<template>
  <main class="dashboard">
    <header class="dashboard__header">
      <h1>Dashboard</h1>
    </header>

    <section class="dashboard__content">
      <div class="user-card">
        <div class="user-card__header">
          <img
            v-if="user?.twitchUser?.profileImageUrl"
            :src="user.twitchUser.profileImageUrl"
            :alt="user.twitchUser.displayName"
            class="user-card__avatar"
          />
          <div v-else class="user-card__avatar user-card__avatar--placeholder">
            👤
          </div>

          <div class="user-card__info">
            <h2 class="user-card__name">
              {{ user?.twitchUser?.displayName || 'Anonymous User' }}
            </h2>
            <p class="user-card__id">ID: {{ user?.id }}</p>
            <div class="user-card__role">
              <span class="role-badge" :class="{ 'role-badge--admin': isAdmin }">
                {{ isAdmin ? '👑 Admin' : '👤 User' }}
              </span>
            </div>
          </div>
        </div>

        <div class="user-card__badges">
          <div v-if="user?.twitchUser" class="user-card__badge user-card__badge--twitch">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
            </svg>
            Twitch connected
          </div>

          <button
            v-else
            class="btn btn--twitch"
            :disabled="isLoading"
            @click="linkTwitch"
          >
            <svg class="btn__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
            </svg>
            Link Twitch Account
          </button>
        </div>
      </div>

      <!-- Admin Panel Link -->
      <NuxtLink v-if="isAdmin" to="/admin/auth-providers" class="admin-panel-link">
        <div class="admin-panel-link__icon">
          ⚙️
        </div>
        <div class="admin-panel-link__content">
          <h3 class="admin-panel-link__title">Admin Panel</h3>
          <p class="admin-panel-link__description">
            Manage authentication providers and system settings
          </p>
        </div>
        <div class="admin-panel-link__arrow">
          →
        </div>
      </NuxtLink>
    </section>
  </main>
</template>

<style scoped>
.dashboard {
  min-block-size: 100dvh;
  padding: var(--space-4);
  max-inline-size: 48rem;
  margin-inline: auto;
}

.dashboard__header {
  padding-block: var(--space-4);
  margin-block-end: var(--space-6);

  & h1 {
    font-size: 1.5rem;
    font-weight: 700;
  }
}

.dashboard__content {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.user-card {
  padding: var(--space-5);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}

.user-card__header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-block-end: var(--space-4);
}

.user-card__avatar {
  inline-size: 4rem;
  block-size: 4rem;
  border-radius: 50%;
  object-fit: cover;

  &--placeholder {
    display: grid;
    place-items: center;
    background: var(--border);
    font-size: 1.5rem;
  }
}

.user-card__name {
  font-size: 1.25rem;
  font-weight: 600;
}

.user-card__id {
  color: var(--text-muted);
  font-size: 0.875rem;
  font-family: var(--font-mono);
}

.user-card__role {
  margin-block-start: var(--space-2);
}

.role-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  background: var(--border);
  color: var(--text);
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
  font-weight: 600;

  &--admin {
    background: oklch(55% 0.2 25 / 0.15);
    color: oklch(45% 0.2 25);
  }
}

.user-card__badges {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.user-card__badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;

  & svg {
    inline-size: 1rem;
    block-size: 1rem;
  }

  &--twitch {
    background: #9146ff20;
    color: #9146ff;
  }
}

.btn--twitch {
  background: #9146ff;
  color: white;

  &:hover:not(:disabled) {
    background: #7c3aed;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.admin-panel-link {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-5);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);

  &:hover {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px oklch(from var(--primary) l c h / 0.1);
  }
}

.admin-panel-link__icon {
  font-size: 2rem;
  flex-shrink: 0;
}

.admin-panel-link__content {
  flex: 1;
}

.admin-panel-link__title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text);
  margin-block-end: var(--space-1);
}

.admin-panel-link__description {
  font-size: 0.875rem;
  color: var(--text-muted);
}

.admin-panel-link__arrow {
  font-size: 1.5rem;
  color: var(--text-muted);
  flex-shrink: 0;
  transition: transform var(--transition-fast);

  .admin-panel-link:hover & {
    transform: translateX(0.25rem);
  }
}
</style>

<template>
  <div class="admin-layout">
    <aside class="admin-sidebar">
      <div class="admin-sidebar__header">
        <h2 class="admin-sidebar__title">⚙️ Admin Panel</h2>
      </div>

      <nav class="admin-sidebar__nav">
        <NuxtLink to="/admin/auth-providers" class="admin-sidebar__link">
          <span class="admin-sidebar__link-icon">🔑</span>
          <span class="admin-sidebar__link-text">Auth Providers</span>
        </NuxtLink>

        <!-- Placeholder for future admin pages -->
        <div class="admin-sidebar__link admin-sidebar__link--disabled">
          <span class="admin-sidebar__link-icon">👥</span>
          <span class="admin-sidebar__link-text">Users</span>
          <span class="admin-sidebar__badge">Soon</span>
        </div>

        <div class="admin-sidebar__link admin-sidebar__link--disabled">
          <span class="admin-sidebar__link-icon">📊</span>
          <span class="admin-sidebar__link-text">Analytics</span>
          <span class="admin-sidebar__badge">Soon</span>
        </div>

        <div class="admin-sidebar__link admin-sidebar__link--disabled">
          <span class="admin-sidebar__link-icon">⚙️</span>
          <span class="admin-sidebar__link-text">Settings</span>
          <span class="admin-sidebar__badge">Soon</span>
        </div>
      </nav>

      <div class="admin-sidebar__footer">
        <NuxtLink to="/dashboard" class="admin-sidebar__back">
          ← Back to Dashboard
        </NuxtLink>
      </div>
    </aside>

    <main class="admin-content">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.admin-layout {
  display: grid;
  grid-template-columns: 16rem 1fr;
  min-block-size: 100dvh;
  background: var(--background);
}

.admin-sidebar {
  background: var(--surface);
  border-inline-end: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  position: sticky;
  inset-block-start: 0;
  block-size: 100dvh;
}

.admin-sidebar__header {
  padding: var(--space-5);
  border-block-end: 1px solid var(--border);
}

.admin-sidebar__title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text);
}

.admin-sidebar__nav {
  flex: 1;
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.admin-sidebar__link {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  color: var(--text-muted);
  font-size: 0.9375rem;
  font-weight: 500;
  transition:
    color var(--transition-fast),
    background-color var(--transition-fast);

  &:hover:not(&--disabled) {
    color: var(--text);
    background-color: var(--background);
  }

  &.router-link-active {
    color: var(--primary);
    background-color: oklch(from var(--primary) l c h / 0.1);
  }

  &--disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.admin-sidebar__link-icon {
  font-size: 1.25rem;
  flex-shrink: 0;
}

.admin-sidebar__link-text {
  flex: 1;
}

.admin-sidebar__badge {
  padding: var(--space-1) var(--space-2);
  background: var(--border);
  color: var(--text-muted);
  border-radius: var(--radius-sm);
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.admin-sidebar__footer {
  padding: var(--space-4);
  border-block-start: 1px solid var(--border);
}

.admin-sidebar__back {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  color: var(--text-muted);
  font-size: 0.875rem;
  font-weight: 500;
  transition:
    color var(--transition-fast),
    background-color var(--transition-fast);

  &:hover {
    color: var(--text);
    background-color: var(--background);
  }
}

.admin-content {
  padding: var(--space-6);
  max-inline-size: 80rem;
  margin-inline: auto;
  inline-size: 100%;
}

/* Responsive design for smaller screens */
@media (max-width: 768px) {
  .admin-layout {
    grid-template-columns: 1fr;
  }

  .admin-sidebar {
    position: relative;
    block-size: auto;
  }
}
</style>

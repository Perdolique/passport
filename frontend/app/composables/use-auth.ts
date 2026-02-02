import { useState } from '#app'
import { $fetch } from 'ofetch'
import { type ComputedRef, type Ref, computed } from 'vue'

/**
 * User roles matching backend enum
 */
type UserRole = 'user' | 'admin'

/**
 * User session data returned from auth service.
 */
interface User {
  id: string
  role: UserRole
  twitchUser?: {
    id: string
    login: string
    displayName: string
    profileImageUrl: string
  } | null
}

/**
 * Auth composable state and methods.
 */
interface UseAuthReturn {
  user: Ref<User | null>
  isLoggedIn: ComputedRef<boolean>
  isAdmin: ComputedRef<boolean>
  isLoading: Ref<boolean>
  fetchSession: () => Promise<void>
  loginWithTwitch: (redirect?: string) => void
  loginAnonymous: () => Promise<void>
  linkTwitch: () => void
  logout: () => Promise<void>
}

/**
 * Redirect to Twitch OAuth login.
 * @param redirect - Optional URL to redirect after login
 * Client-only: uses globalThis.location
 */
function loginWithTwitch(redirect?: string): void {
  if (import.meta.client) {
    const url = new URL('/api/auth/twitch', globalThis.location.origin)

    if (redirect !== undefined && redirect !== '') {
      url.searchParams.set('redirect', redirect)
    }

    globalThis.location.href = url.toString()
  }
}

/**
 * Link Twitch account to existing session.
 * Requires active session.
 * Client-only: uses globalThis.location
 */
function linkTwitch(): void {
  if (import.meta.client) {
    globalThis.location.href = '/api/auth/twitch?link=true'
  }
}

/**
 * Composable for authentication state and actions.
 * Uses proxy server routes to communicate with passport.
 * SSR-compatible version with client-only checks.
 */
function useAuth(): UseAuthReturn {
  const user = useState<User | null>('auth-user', () => null)
  const isLoading = useState('auth-loading', () => false)
  const isLoggedIn = computed(() => user.value !== null)
  const isAdmin = computed(() => user.value?.role === 'admin')

  /**
   * Fetch current session from passport.
   * SSR-safe: uses $fetch which works on both client and server.
   */
  async function fetchSession(): Promise<void> {
    isLoading.value = true

    try {
      const data = await $fetch<User>('/api/auth/session', {
        credentials: 'include',
      })

      user.value = data
    } catch {
      user.value = null
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Create anonymous user session.
   * SSR-safe: uses $fetch.
   */
  async function loginAnonymous(): Promise<void> {
    isLoading.value = true

    try {
      const data = await $fetch<User>('/api/auth/anonymous', {
        method: 'POST',
        credentials: 'include',
      })

      user.value = data
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Logout current session.
   * SSR-safe: uses $fetch.
   */
  async function logout(): Promise<void> {
    isLoading.value = true

    try {
      await $fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })

      user.value = null
    } finally {
      isLoading.value = false
    }
  }

  return {
    user,
    isLoggedIn,
    isAdmin,
    isLoading,
    fetchSession,
    loginWithTwitch,
    loginAnonymous,
    linkTwitch,
    logout,
  }
}

export type { UserRole, User, UseAuthReturn };
export { useAuth };

import { useAuth } from '~/composables/useAuth'

/**
 * Auth middleware - protects routes that require authentication.
 * Redirects to /login if no active session.
 * SSR-compatible version.
 */
export default defineNuxtRouteMiddleware(async () => {
  const { user, isLoading, fetchSession } = useAuth()

  // Wait for loading to complete
  if (isLoading.value) {
    return
  }

  // Fetch session if not loaded yet
  if (user.value === null) {
    await fetchSession()
  }

  // Redirect to login if still no user
  if (user.value === null) {
    return navigateTo('/login')
  }
})

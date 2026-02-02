import { defineNuxtRouteMiddleware, navigateTo } from '#app'
import { useAuth } from '~/composables/use-auth'

/**
 * Admin middleware - protects admin routes.
 * Requires authentication and admin role.
 * Redirects to /login if not authenticated, to / if not admin.
 */
export default defineNuxtRouteMiddleware(async () => {
  const { user, isAdmin, isLoading, fetchSession } = useAuth()

  // Wait for loading to complete
  if (isLoading.value) {
    return
  }

  // Fetch session if not loaded yet
  if (user.value === null) {
    await fetchSession()
  }

  // Redirect to login if not authenticated
  if (user.value === null) {
    return navigateTo('/login')
  }

  // Redirect to home if not admin
  if (!isAdmin.value) {
    return navigateTo('/')
  }
})

import axios from 'axios'

/**
 * Extract a user-friendly error message from an API error.
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || fallback
  }
  return fallback
}

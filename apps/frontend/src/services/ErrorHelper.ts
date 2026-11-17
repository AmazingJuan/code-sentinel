// apps/frontend/src/services/ErrorHelper.ts
import axios from 'axios'

export interface ParsedError {
  title: string
  message: string
  status?: number
  isNetworkError: boolean
}

/**
 * Extracts a human-readable, actionable error message from any backend or network error.
 */
export function extractErrorMessage(error: unknown, fallback = 'An unexpected error occurred. Please try again.'): string {
  return parseError(error, fallback).message
}

/**
 * Parses unknown errors into structured error information with status codes and friendly titles.
 */
export function parseError(error: unknown, fallback = 'An unexpected error occurred. Please try again.'): ParsedError {
  if (axios.isAxiosError(error)) {
    // Network / connectivity issues
    if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
      return {
        title: 'Connection Failed',
        message: 'Could not connect to Code Sentinel server. Verify your connection or that the backend is running.',
        isNetworkError: true,
      }
    }

    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return {
        title: 'Request Timed Out',
        message: 'The server took too long to respond. Please check your network and try again.',
        isNetworkError: true,
      }
    }

    const status = error.response?.status
    const data = error.response?.data as { message?: string | string[]; error?: string } | undefined

    let backendMessage = ''
    if (data?.message) {
      if (Array.isArray(data.message)) {
        backendMessage = data.message.join('. ')
      } else if (typeof data.message === 'string') {
        backendMessage = data.message
      }
    } else if (data?.error && typeof data.error === 'string') {
      backendMessage = data.error
    }

    if (status === 400) {
      return {
        title: 'Validation Error',
        message: backendMessage || 'Please verify the submitted information and try again.',
        status: 400,
        isNetworkError: false,
      }
    }

    if (status === 401) {
      return {
        title: 'Authentication Required',
        message: backendMessage || 'Your session has expired or is invalid. Please sign in again.',
        status: 401,
        isNetworkError: false,
      }
    }

    if (status === 403) {
      return {
        title: 'Access Denied',
        message: backendMessage || 'You do not have permission to view or modify this resource.',
        status: 403,
        isNetworkError: false,
      }
    }

    if (status === 404) {
      return {
        title: 'Not Found',
        message: backendMessage || 'The requested resource could not be found.',
        status: 404,
        isNetworkError: false,
      }
    }

    if (status === 409) {
      return {
        title: 'Conflict Detected',
        message: backendMessage || 'A record with this information already exists.',
        status: 409,
        isNetworkError: false,
      }
    }

    if (status && status >= 500) {
      return {
        title: 'Server Error',
        message: backendMessage || 'The security server encountered an internal error. Please try again shortly.',
        status,
        isNetworkError: false,
      }
    }

    if (backendMessage) {
      return {
        title: 'Error',
        message: backendMessage,
        status,
        isNetworkError: false,
      }
    }
  }

  return {
    title: 'Error',
    message: fallback,
    isNetworkError: false,
  }
}

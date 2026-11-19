import axios from 'axios'

export interface ParsedError {
  title: string
  message: string
  status?: number
  isNetworkError: boolean
}

export interface ErrorMessageOptions {
  /** Message to show on a 403, replacing the backend text with a resource-specific one. */
  forbidden?: string
}

const DEFAULT_FALLBACK = 'An unexpected error occurred. Please try again.'

const STATUS_DEFAULTS: Record<number, { title: string; message: string }> = {
  400: {
    title: 'Validation Error',
    message: 'Please verify the submitted information and try again.',
  },
  401: {
    title: 'Authentication Required',
    message: 'Your session has expired or is invalid. Please sign in again.',
  },
  403: {
    title: 'Access Denied',
    message: 'You do not have permission to view or modify this resource.',
  },
  404: {
    title: 'Not Found',
    message: 'The requested resource could not be found.',
  },
  409: {
    title: 'Conflict Detected',
    message: 'A record with this information already exists.',
  },
}

const SERVER_ERROR_DEFAULT = {
  title: 'Server Error',
  message: 'The security server encountered an internal error. Please try again shortly.',
}

function readBackendMessage(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const { message, error } = data as { message?: unknown; error?: unknown }
  if (Array.isArray(message)) return message.join('. ')
  if (typeof message === 'string') return message
  if (typeof error === 'string') return error
  return ''
}

/** Returns a user-facing message for any backend or network error. */
export function extractErrorMessage(
  error: unknown,
  fallback: string = DEFAULT_FALLBACK,
  options: ErrorMessageOptions = {},
): string {
  if (options.forbidden && axios.isAxiosError(error) && error.response?.status === 403) {
    return options.forbidden
  }
  return parseError(error, fallback).message
}

/** Normalizes an unknown error into a title, message and status suitable for the UI. */
export function parseError(error: unknown, fallback: string = DEFAULT_FALLBACK): ParsedError {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
      return {
        title: 'Connection Failed',
        message:
          'Could not connect to Code Sentinel server. Verify your connection or that the backend is running.',
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
    const backendMessage = readBackendMessage(error.response?.data)
    const defaults =
      status !== undefined
        ? (STATUS_DEFAULTS[status] ?? (status >= 500 ? SERVER_ERROR_DEFAULT : undefined))
        : undefined

    if (defaults) {
      return {
        title: defaults.title,
        message: backendMessage || defaults.message,
        status,
        isNetworkError: false,
      }
    }

    if (backendMessage) {
      return { title: 'Error', message: backendMessage, status, isNetworkError: false }
    }
  }

  return { title: 'Error', message: fallback, isNetworkError: false }
}

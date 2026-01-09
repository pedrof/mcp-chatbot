import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'

/**
 * Custom API Error class with status code
 */
export class APIError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message)
    this.name = 'APIError'
  }
}

/**
 * Sends a standardized error response
 * @param res Express response object
 * @param statusCode HTTP status code
 * @param message Error message
 * @param details Optional additional error details
 */
export function sendErrorResponse(
  res: Response,
  statusCode: number,
  message: string,
  details?: any
): void {
  res.status(statusCode).json({
    error: message,
    ...(details && { details })
  })
}

/**
 * Sends a validation error response from Zod validation
 * @param res Express response object
 * @param zodError Zod validation error
 */
export function sendValidationError(
  res: Response,
  zodError: z.ZodError
): void {
  sendErrorResponse(
    res,
    400,
    'Validation failed',
    zodError.errors
  )
}

/**
 * Sets up Server-Sent Events (SSE) headers
 * @param res Express response object
 */
export function setupSSEHeaders(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
}

/**
 * Wraps async route handlers to catch errors and send proper error responses
 * @param fn Async function that handles the request
 * @returns Express middleware function
 */
export function asyncHandler(
  fn: (req: Request, res: Response) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res)).catch((error: Error) => {
      console.error('API Error:', error)

      // Handle custom API errors with status codes
      if (error instanceof APIError) {
        sendErrorResponse(res, error.statusCode, error.message, error.details)
      } else {
        res.status(500).json({ error: error.message })
      }
    })
  }
}

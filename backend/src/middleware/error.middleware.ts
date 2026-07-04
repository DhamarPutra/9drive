import type { NextFunction, Request, Response } from 'express'

export function errorMiddleware(error: any, _req: Request, res: Response, _next: NextFunction) {
  const status = error.statusCode || 500
  const code = error.code || 'INTERNAL_SERVER_ERROR'
  const message = error instanceof Error ? error.message : 'Internal server error'
  return res.status(status).json({ code, message })
}


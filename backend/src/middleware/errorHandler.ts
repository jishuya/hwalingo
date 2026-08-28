import type { ErrorRequestHandler } from 'express'

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  console.error(error)

  if (error instanceof Error && (error.name === 'APIConnectionTimeoutError' || error.name === 'APIConnectionError')) {
    response.status(504).json({
      status: 'error',
      message: 'AI 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.',
    })
    return
  }

  if (typeof error === 'object' && error !== null && 'status' in error && error.status === 429) {
    response.status(503).json({
      status: 'error',
      message: 'AI 요청이 많아 잠시 지연되고 있습니다. 잠시 후 다시 시도해주세요.',
    })
    return
  }

  response.status(500).json({
    status: 'error',
    message: 'Internal server error',
  })
}

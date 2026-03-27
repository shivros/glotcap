import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { auth } from './auth'
import { resend } from './emails'
import { streamCoachReply } from './coach'
import { stream as streamTts } from './ttsStream'

const http = httpRouter()

auth.addHttpRoutes(http)

http.route({
  path: '/resend-webhook',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    return await resend.handleResendEventWebhook(ctx, request)
  }),
})

http.route({
  path: '/coach-stream',
  method: 'POST',
  handler: streamCoachReply,
})

http.route({
  path: '/coach-stream',
  method: 'OPTIONS',
  handler: httpAction((_, request) => {
    const headers = request.headers
    if (
      headers.get('Origin') !== null &&
      headers.get('Access-Control-Request-Method') !== null &&
      headers.get('Access-Control-Request-Headers') !== null
    ) {
      return Promise.resolve(
        new Response(null, {
          headers: new Headers({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400',
          }),
        }),
      )
    }
    return Promise.resolve(new Response())
  }),
})

http.route({
  path: '/tts-stream',
  method: 'POST',
  handler: streamTts,
})

http.route({
  path: '/tts-stream',
  method: 'OPTIONS',
  handler: httpAction((_, request) => {
    const headers = request.headers
    if (
      headers.get('Origin') !== null &&
      headers.get('Access-Control-Request-Method') !== null &&
      headers.get('Access-Control-Request-Headers') !== null
    ) {
      return Promise.resolve(
        new Response(null, {
          headers: new Headers({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400',
          }),
        }),
      )
    }
    return Promise.resolve(new Response())
  }),
})

export default http

import { httpAction } from './_generated/server'
import { api, internal } from './_generated/api'
import { streamingComponent } from './streaming'
import { runCoachStream } from './coach/stream'
import type { StreamId } from '@convex-dev/persistent-text-streaming'

export const streamCoachReply = httpAction(async (ctx, request) => {
  const body = (await request.json()) as { streamId?: string }
  const streamId = body.streamId
  if (!streamId) {
    return new Response('Missing streamId', { status: 400 })
  }

  const event = await ctx.runQuery(internal.speaking.getEventByStream, {
    streamId,
  })
  if (!event) {
    return new Response('Stream not found', { status: 404 })
  }
  if (event.streamStatus === 'canceled') {
    return new Response('Stream canceled', { status: 409 })
  }

  const session = await ctx.runQuery(api.speaking.getSession, {
    sessionId: event.sessionId,
  })
  if (!session) {
    return new Response('Session not found', { status: 404 })
  }

  const runtime = await ctx.runQuery(api.speaking.getSessionRuntime, {
    sessionId: event.sessionId,
  })
  if (event.turnId && runtime.activeTurnId !== event.turnId) {
    await ctx.runMutation(internal.speaking.updateStreamEvent, {
      eventId: event._id,
      streamStatus: 'canceled',
    })
    return new Response('Stream canceled', { status: 409 })
  }

  const response = await streamingComponent.stream(
    ctx,
    request,
    streamId as StreamId,
    async (actionCtx, _request, currentStreamId, append) => {
      await runCoachStream({
        ctx: actionCtx,
        sessionId: session._id,
        eventId: event._id,
        streamId: currentStreamId,
        targetLanguage: session.targetLanguage,
        sourceLanguage: session.sourceLanguage ?? undefined,
        userId: session.userId,
        append,
      })
    },
  )

  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Vary', 'Origin')

  return response
})

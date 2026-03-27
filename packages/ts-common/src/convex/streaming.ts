import type {
  FunctionVisibility,
  GenericDataModel,
  QueryBuilder,
} from 'convex/server'

export const createPersistentTextStreaming = <TStreaming>(
  StreamingCtor: new (
    componentRef: any,
    options?: Record<string, unknown>,
  ) => TStreaming,
  componentRef: unknown,
) => new StreamingCtor(componentRef as never)

export const createGetStreamBodyQuery = <
  TDataModel extends GenericDataModel,
  TVisibility extends FunctionVisibility,
  TCtx,
  TStreamId,
  TBody,
>(
  query: QueryBuilder<TDataModel, TVisibility>,
  streamIdValidator: any,
  streamingComponent: {
    getStreamBody: (ctx: TCtx, streamId: TStreamId) => Promise<TBody> | TBody
  },
) =>
  query({
    args: {
      streamId: streamIdValidator,
    },
    handler: async (ctx, args) =>
      Promise.resolve(
        streamingComponent.getStreamBody(
          ctx as unknown as TCtx,
          args.streamId as unknown as TStreamId,
        ),
      ),
  })

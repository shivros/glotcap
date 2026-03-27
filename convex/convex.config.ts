import { defineApp } from 'convex/server'
import persistentTextStreaming from '@convex-dev/persistent-text-streaming/convex.config'
import resend from '@convex-dev/resend/convex.config'
import neutralCost from 'neutral-cost/convex.config'

const app = defineApp()
app.use(resend)
app.use(persistentTextStreaming)
app.use(neutralCost)

export default app

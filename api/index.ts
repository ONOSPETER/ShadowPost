/**
 * Vercel Serverless Entry Point
 *
 * Exports the Express app for Vercel's serverless runtime.
 * Vercel calls this as a function instead of running a persistent server.
 * app.listen() must NOT be called at module scope — keep that in
 * artifacts/api-server/src/index.ts for local dev only.
 */

import app from '../artifacts/api-server/src/app'

export default app

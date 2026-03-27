export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Array<Json>

// Placeholder - regenerate with `bun run db:types` when database is set up
export type Database = {}

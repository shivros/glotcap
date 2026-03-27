/**
 * Feature flags utilities for Vercel Edge Config
 *
 * Server-side utilities for reading feature flags from Vercel Edge Config.
 * Use in loaders, beforeLoad, API routes - not in client components.
 */

import { get } from '@vercel/edge-config'

/**
 * Creates a typed getter for Edge Config feature flags.
 * Use server-side only (in loaders, beforeLoad, API routes).
 *
 * @example
 * ```ts
 * type MyFlags = { underConstruction: boolean }
 * const getFlag = createEdgeConfigGetter<MyFlags>('my-app')
 * const isUnderConstruction = await getFlag('underConstruction', false)
 * ```
 */
export function createEdgeConfigGetter<T extends object>(configName: string) {
  return async <TKey extends keyof T>(
    key: TKey,
    defaultValue: T[TKey],
  ): Promise<T[TKey]> => {
    try {
      const config = await get<T>(configName)
      const value = config?.[key]
      if (value !== undefined) {
        return value as T[TKey]
      }
    } catch (e) {
      if (
        e instanceof Error &&
        e.message.includes('No connection string provided')
      ) {
        console.debug(
          `No connection string provided for edge config '${configName}'`,
        )
      } else {
        console.warn(
          `Could not read flag '${String(key)}' from edge config '${configName}'.`,
          e,
        )
      }
    }
    return defaultValue
  }
}

/**
 * Standard flags interface for under construction feature.
 * Extend this with package-specific flags.
 */
export interface UnderConstructionFlags {
  underConstruction: boolean
}

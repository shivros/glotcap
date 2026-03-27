export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export const createBrowserKeyValueStore = (): KeyValueStore | null => {
  if (typeof window === 'undefined') {
    return null
  }
  return window.localStorage
}

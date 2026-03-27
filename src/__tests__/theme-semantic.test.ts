import { describe, expect, it } from 'vitest'

import * as semantic from '@/theme/semantic'

describe('theme semantic contracts', () => {
  it('exports non-empty semantic class contracts', () => {
    const entries = Object.entries(semantic)

    expect(entries.length).toBeGreaterThan(10)

    for (const [key, value] of entries) {
      expect(key.startsWith('APP_')).toBe(true)
      expect(typeof value).toBe('string')
      expect(value.length).toBeGreaterThan(0)
    }
  })

  it('keeps modal and primary action tokens aligned with the app palette', () => {
    expect(semantic.APP_MODAL_CONTENT_CLASS).toContain('#0d1117')
    expect(semantic.APP_MODAL_CONTENT_CLASS).toContain('backdrop-blur')
    expect(semantic.APP_PRIMARY_BUTTON_CLASS).toContain('var(--glotcap-teal)')
    expect(semantic.APP_PRIMARY_BUTTON_CLASS).toContain('var(--glotcap-sky)')
  })
})

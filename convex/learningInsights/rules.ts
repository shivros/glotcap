export type CanonicalRule = {
  pattern: RegExp
  canonical: string
  category: string
}

export const canonicalRules: Array<CanonicalRule> = [
  {
    pattern: /\barticle\b|\barticles\b/,
    canonical: 'articles',
    category: 'grammar',
  },
  {
    pattern: /\bpreposition\b|\bprepositions\b/,
    canonical: 'prepositions',
    category: 'grammar',
  },
  {
    pattern: /\btense\b|\bpast tense\b|\bpresent tense\b|\bfuture tense\b/,
    canonical: 'verb tense',
    category: 'grammar',
  },
  {
    pattern: /\bconjugation\b|\bconjugate\b|\bverb form\b/,
    canonical: 'verb conjugation',
    category: 'grammar',
  },
  {
    pattern: /\bagreement\b|\bsubject verb\b|\bsubject-verb\b/,
    canonical: 'agreement',
    category: 'grammar',
  },
  {
    pattern: /\bplural\b|\bplurals\b|\bsingular\b/,
    canonical: 'plurals',
    category: 'grammar',
  },
  { pattern: /\bword order\b/, canonical: 'word order', category: 'syntax' },
  {
    pattern: /\bregister\b|\bformal\b|\binformal\b/,
    canonical: 'register',
    category: 'register',
  },
  {
    pattern: /\bpronunciation\b|\bpronounce\b/,
    canonical: 'pronunciation',
    category: 'pronunciation',
  },
  { pattern: /\bgender\b/, canonical: 'gender agreement', category: 'grammar' },
  {
    pattern: /\bword choice\b|\bvocabulary\b|\blexical\b/,
    canonical: 'word choice',
    category: 'vocabulary',
  },
]

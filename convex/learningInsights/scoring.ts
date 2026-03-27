export const computeRecencyScore = ({
  count,
  lastSeenAt,
  now,
  halfLifeDays,
}: {
  count: number
  lastSeenAt: number
  now: number
  halfLifeDays: number
}) => {
  const ageDays = Math.max((now - lastSeenAt) / (1000 * 60 * 60 * 24), 0)
  return count * Math.exp(-ageDays / halfLifeDays)
}

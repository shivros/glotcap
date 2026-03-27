import { createFileRoute } from '@tanstack/react-router'
import { LandingCinematic } from '@/components/landing/landing-cinematic'

export const Route = createFileRoute('/1')({ component: LandingCinematic })

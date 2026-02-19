import type { JobSource } from './types'
import { emploiTerritorial } from './emploi-territorial'
import { hellowork } from './hellowork'
import { indeed } from './indeed'
import { linkedin } from './linkedin'
import { welcometothejungle } from './welcometothejungle'

const sources: JobSource[] = [emploiTerritorial, hellowork, indeed, linkedin, welcometothejungle]

export function getSources(): JobSource[] {
  return sources
}

export function getSourceById(id: string): JobSource | undefined {
  return sources.find((s) => s.id === id)
}

export const SOURCE_DEFINITIONS = [
  { id: 'emploi-territorial', name: 'Emploi Territorial', baseUrl: 'https://www.emploi-territorial.fr' },
  { id: 'hellowork', name: 'HelloWork', baseUrl: 'https://www.hellowork.com' },
  { id: 'isarta', name: 'Isarta', baseUrl: 'https://www.isarta.com' },
  { id: 'indeed', name: 'Indeed', baseUrl: 'https://fr.indeed.com' },
  { id: 'welcometothejungle', name: 'Welcome to the Jungle', baseUrl: 'https://www.welcometothejungle.com' },
  { id: 'linkedin', name: 'LinkedIn', baseUrl: 'https://www.linkedin.com/jobs' },
] as const

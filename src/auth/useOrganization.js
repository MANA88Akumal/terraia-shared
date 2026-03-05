import { useContext } from 'react'
import { OrgContext } from './OrgProvider.jsx'

export function useOrganization() {
  const ctx = useContext(OrgContext)
  if (!ctx) {
    throw new Error('useOrganization must be used within an OrgProvider')
  }
  return ctx
}

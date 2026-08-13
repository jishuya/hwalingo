import type { ReactNode } from 'react'

export default function Icon({ children }: { children: ReactNode }) {
  return <span className="icon">{children}</span>
}

import type { ReactNode } from 'react'

type PageNoticeProps = {
  icon: ReactNode
  title: string
  description?: ReactNode
  children: ReactNode
  role?: 'alert' | 'status'
}

export default function PageNotice({ icon, title, description, children, role = 'status' }: PageNoticeProps) {
  return <section className="page-notice" role={role}>
    <span className="page-notice-icon" aria-hidden="true">{icon}<i/></span>
    <h2>{title}</h2>
    {description && <p className="page-notice-description">{description}</p>}
    {children}
  </section>
}

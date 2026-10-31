import { createContext, useContext } from 'react'
import type { AnalyticsSelection } from '../../services/analytics'
export const AnalyticsContext = createContext<{ selection: AnalyticsSelection; label: string }>({ selection: {},label: '최근 7일' })
export const useAnalyticsPeriod = () => useContext(AnalyticsContext)

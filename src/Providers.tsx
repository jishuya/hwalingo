import React from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import queryClient from './services/queryClient'

const Providers: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

export default Providers

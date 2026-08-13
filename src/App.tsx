import React from 'react'

export default function App() {
  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased">
      <header className="safe-top p-4 bg-teal-500 text-white">
        <h1 className="text-lg font-semibold">Hwalingo</h1>
      </header>
      <main className="p-4">
        <section className="max-w-md mx-auto">
          <div className="rounded-lg border border-slate-200 p-6 text-center">
            <p className="text-sm text-slate-600">앱 초기 화면 — 모바일 우선 레이아웃</p>
          </div>
        </section>
      </main>
    </div>
  )
}


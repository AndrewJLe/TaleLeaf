"use client";

import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-100 via-emerald-50 to-amber-50/30 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-10 left-10 w-32 h-32 bg-emerald-600 rounded-full blur-3xl"></div>
        <div className="absolute top-40 right-20 w-48 h-48 bg-amber-600 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-1/3 w-40 h-40 bg-emerald-800 rounded-full blur-3xl"></div>
      </div>

      <div className="relative flex items-center justify-center min-h-screen p-8">
        <div className="max-w-5xl w-full">
          {/* Header */}
          <header className="text-center mb-16">
            <div className="flex items-center justify-center gap-4 mb-8">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center shadow-2xl">
                <span className="text-3xl">🍃</span>
              </div>
              <div>
                <h1 className="text-6xl font-black bg-gradient-to-r from-emerald-800 to-emerald-600 bg-clip-text text-transparent">
                  TaleLeaf
                </h1>
                <p className="text-emerald-700 font-medium text-lg">Your reading garden</p>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left Column */}
            <div className="space-y-8">
              <div className="space-y-6">
                <h2 className="text-4xl font-bold text-emerald-900 leading-tight">
                  Track your stories,<br />
                  <span className="text-amber-700">protect from spoilers</span>
                </h2>
                <p className="text-lg text-emerald-700 leading-relaxed">
                  A gentle place to track characters, locations and notes as you read.
                  Control exactly what the AI can see with page windows and keep spoilers at bay.
                </p>
              </div>

              <div className="space-y-4">
                <Link
                  href="/profile"
                  className="inline-flex items-center gap-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white px-8 py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
                >
                  <span className="text-xl">📚</span>
                  Open your library
                </Link>
                <p className="text-sm text-emerald-600">Start tracking your first book today</p>
              </div>
            </div>

            {/* Right Column - Feature Cards */}
            <div className="space-y-6">
              <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-emerald-200 shadow-lg hover:shadow-xl transition-all duration-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <span className="text-lg">🎭</span>
                  </div>
                  <h3 className="text-lg font-semibold text-emerald-900">Character Tracking</h3>
                </div>
                <p className="text-emerald-700">Keep detailed notes on characters as they develop throughout your story.</p>
              </div>

              <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-amber-200 shadow-lg hover:shadow-xl transition-all duration-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                    <span className="text-lg">🛡️</span>
                  </div>
                  <h3 className="text-lg font-semibold text-amber-900">Spoiler Protection</h3>
                </div>
                <p className="text-amber-700">AI only sees the pages you choose, keeping future plot points hidden.</p>
              </div>

              <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-emerald-200 shadow-lg hover:shadow-xl transition-all duration-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <span className="text-lg">🗺️</span>
                  </div>
                  <h3 className="text-lg font-semibold text-emerald-900">World Building</h3>
                </div>
                <p className="text-emerald-700">Track locations, notes, and plot developments in organized sections.</p>
              </div>
            </div>
          </main>

          {/* Footer */}
          <footer className="text-center mt-20 py-8">
            <p className="text-emerald-600 text-sm">
              Made with 🌿 for readers who love to dive deep into their stories
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}

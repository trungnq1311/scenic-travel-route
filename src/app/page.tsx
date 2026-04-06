'use client';

import InputForm from '@/components/InputForm';

export default function Home() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-4 py-16"
      style={{
        background: 'radial-gradient(ellipse at center, #f5f5f4 0%, #fafaf9 70%)',
      }}
    >
      <div className="flex w-full max-w-lg flex-col items-center space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl">
            Scenic Travel Route
          </h1>
          <p className="text-lg text-stone-500">
            Turn any drive into a scenic journey
          </p>
        </div>

        {/* Form */}
        <InputForm />

        {/* Footer */}
        <p className="pt-4 text-center text-sm text-stone-400">
          AI-powered scenic route discovery for Vietnam
        </p>
      </div>
    </main>
  );
}

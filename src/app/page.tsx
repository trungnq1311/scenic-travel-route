'use client';

import InputForm from '@/components/InputForm';

export default function Home() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-4 py-8 lg:py-16"
      style={{
        background: 'radial-gradient(ellipse at center, #f5f0e8 0%, #faf7f2 70%)',
      }}
    >
      {/* Desktop: Centered card layout */}
      <div className="hidden lg:flex w-full max-w-lg flex-col items-center space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl font-display">
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

      {/* Mobile: Floating map background with search overlay */}
      <div className="fixed inset-0 lg:relative lg:inset-auto lg:flex lg:w-full lg:max-w-lg lg:flex-col lg:items-center lg:space-y-8">
        {/* Map background placeholder */}
        <div 
          className="fixed inset-0 -z-10 lg:relative lg:inset-auto lg:-z-10 lg:h-64 lg:w-full lg:rounded-2xl lg:overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, #87CEEB 0%, #98D8C8 40%, #F5A623 100%)',
          }}
        >
          {/* Decorative route line */}
          <svg
            className="absolute inset-0 w-full h-full opacity-30"
            viewBox="0 0 400 300"
            preserveAspectRatio="none"
          >
            <path
              d="M50,250 Q100,200 150,180 T250,120 T350,80"
              fill="none"
              stroke="#2A2622"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
          
          {/* Decorative mountains */}
          <svg
            className="absolute bottom-0 w-full h-24"
            viewBox="0 0 400 100"
            preserveAspectRatio="none"
          >
            <path
              d="M0,100 L50,60 L100,80 L150,40 L200,70 L250,30 L300,60 L350,50 L400,100 Z"
              fill="#7BA05B"
              opacity="0.6"
            />
            <path
              d="M0,100 L80,70 L150,90 L220,50 L300,80 L400,100 Z"
              fill="#5D8040"
              opacity="0.4"
            />
          </svg>
        </div>

        {/* Mobile Search Card */}
        <div className="fixed inset-x-4 top-4 rounded-xl bg-white/95 p-4 shadow-xl backdrop-blur-sm lg:hidden">
          <h1 className="text-xl font-bold tracking-tight text-stone-900 font-display mb-3">
            Scenic Travel Route
          </h1>
          <p className="text-sm text-stone-500 mb-4">
            Turn any drive into a scenic journey
          </p>
          <InputForm />
        </div>

        {/* Mobile decorative footer */}
        <div className="fixed bottom-8 left-4 right-4 text-center text-sm text-stone-500 lg:hidden">
          <p>AI-powered scenic route discovery</p>
        </div>
      </div>
    </main>
  );
}

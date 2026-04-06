import './globals.css';
import 'mapbox-gl/dist/mapbox-gl.css';

export const metadata = {
  title: 'Scenic Travel Route',
  description: 'AI-powered scenic road trip planner for Vietnam',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased">
        {children}
      </body>
    </html>
  );
}

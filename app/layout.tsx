import { Analytics } from '@vercel/analytics/next'
import { Cairo } from 'next/font/google'
import type { Metadata, Viewport } from 'next'
import './globals.css'

const cairo = Cairo({ subsets: ['arabic'], variable: '--font-cairo' })

export const metadata: Metadata = {
  title: 'معلّم | تطبيق إدارة الدروس الخصوصية',
  description: 'إدارة المجموعات والطلاب والحضور والاختبارات بسهولة للأستاذ والطلاب.',
  applicationName: 'معلّم',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'معلّم',
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  colorScheme: 'light',
  themeColor: '#153b68',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ar" dir="rtl" className="h-full">
      <body className={`${cairo.variable} min-h-full font-sans antialiased text-[#17263b] selection:bg-[#1d5ca8] selection:text-white`}>
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}

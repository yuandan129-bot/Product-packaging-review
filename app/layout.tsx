import type { Metadata } from 'next'
import Footer from '../components/Footer'
import SplashGuard from '../components/SplashGuard'
import './globals.css'

export const metadata: Metadata = {
  title: '包装合规审核系统',
  description: '智能包装背标合规性审核',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" data-scroll-behavior="smooth">
      <body>
        <SplashGuard>{children}</SplashGuard>
        <Footer />
      </body>
    </html>
  )
}

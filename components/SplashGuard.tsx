'use client'

import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export default function SplashGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const checkedRef = useRef(false)

  useEffect(() => {
    // splash 和管理后台不检查
    if (pathname === '/splash' || pathname === '/history') {
      checkedRef.current = true
      return
    }

    // 只检查首次加载（刷新），客户端后续导航不检查
    if (checkedRef.current) return
    checkedRef.current = true

    const params = new URLSearchParams(window.location.search)
    if (params.get('from') !== 'splash') {
      router.replace('/splash')
    }
  }, [pathname, router])

  return <>{children}</>
}

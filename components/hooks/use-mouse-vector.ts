import { useState, useEffect, useRef } from "react"

interface MouseVector {
  position: { x: number; y: number }
  vector: { x: number; y: number }
}

export function useMouseVector(containerRef?: React.RefObject<HTMLElement>): MouseVector {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [vector, setVector] = useState({ x: 0, y: 0 })
  const prevPos = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const el = containerRef?.current ?? document.body
    if (!el) return

    const handleMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      setPosition({ x, y })
      setVector({
        x: e.clientX - prevPos.current.x,
        y: e.clientY - prevPos.current.y,
      })
      prevPos.current = { x: e.clientX, y: e.clientY }
    }

    el.addEventListener("mousemove", handleMouseMove as EventListener)
    return () => el.removeEventListener("mousemove", handleMouseMove as EventListener)
  }, [containerRef])

  return { position, vector }
}

"use client"

import { Children, useCallback, useEffect, useMemo, useRef } from "react"
import {
  type AnimationSequence,
  motion,
  type Target,
  type Transition,
  useAnimate,
  useAnimationFrame,
} from "motion/react"
import { useMouseVector } from "./hooks/use-mouse-vector"

type TrailSegment = [Target, Transition]
type TrailAnimationSequence = TrailSegment[]

interface ImageTrailProps {
  children: React.ReactNode
  containerRef?: React.RefObject<HTMLElement>
  newOnTop?: boolean
  random?: boolean
  rotationRange?: number
  animationSequence?: TrailAnimationSequence
  interval?: number
}

interface TrailItem {
  id: string
  x: number
  y: number
  rotation: number
  animationSequence: TrailAnimationSequence
  scale: number
  child: React.ReactNode
}

let _idCounter = 0
function generateId(): string {
  return `trail-${++_idCounter}-${Date.now()}`
}

function ImageTrail({
  children,
  newOnTop = true,
  random = false,
  rotationRange = 15,
  containerRef,
  animationSequence = [
    [{ scale: 1.2 }, { duration: 0.1, ease: "circOut" }],
    [{ scale: 0 }, { duration: 0.5, ease: "circIn" }],
  ],
  interval = 100,
}: ImageTrailProps) {
  const trailRef = useRef<TrailItem[]>([])
  const lastAddedTimeRef = useRef<number>(0)
  const { position: mousePosition } = useMouseVector(containerRef)
  const lastMousePosRef = useRef(mousePosition)
  const currentIndexRef = useRef(0)
  const childrenArray = useMemo(() => Children.toArray(children), [children])

  const lastRandomRef = useRef(-1)

  const addToTrail = useCallback(
    (mousePos: { x: number; y: number }) => {
      if (childrenArray.length === 0) return

      let idx: number
      if (random) {
        // 避免连续重复：从剩余候选中随机选
        const candidates = childrenArray
          .map((_, i) => i)
          .filter((i) => childrenArray.length === 1 || i !== lastRandomRef.current)
        idx = candidates[Math.floor(Math.random() * candidates.length)]
        lastRandomRef.current = idx
      } else {
        idx = currentIndexRef.current
        currentIndexRef.current = (idx + 1) % childrenArray.length
      }

      const newItem: TrailItem = {
        id: generateId(),
        x: mousePos.x,
        y: mousePos.y,
        rotation: (Math.random() - 0.5) * rotationRange * 2,
        animationSequence,
        scale: 1,
        child: childrenArray[idx],
      }

      if (newOnTop) {
        trailRef.current.push(newItem)
      } else {
        trailRef.current.unshift(newItem)
      }

      // 限制最大 trail 数量，防止 DOM 过载导致卡顿
      const MAX_ITEMS = 30
      while (trailRef.current.length > MAX_ITEMS) {
        trailRef.current.shift()
      }
    },
    [childrenArray, rotationRange, animationSequence, newOnTop]
  )

  const removeFromTrail = useCallback((itemId: string) => {
    const index = trailRef.current.findIndex((item) => item.id === itemId)
    if (index !== -1) {
      trailRef.current.splice(index, 1)
    }
  }, [])

  useAnimationFrame((time, _delta) => {
    if (
      lastMousePosRef.current.x === mousePosition.x &&
      lastMousePosRef.current.y === mousePosition.y
    ) {
      return
    }
    lastMousePosRef.current = mousePosition

    if (time - lastAddedTimeRef.current < interval) {
      return
    }
    lastAddedTimeRef.current = time

    addToTrail(mousePosition)
  })

  return (
    <div className="pointer-events-none" style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {trailRef.current.map((item) => (
        <TrailUnit key={item.id} item={item} onComplete={removeFromTrail} />
      ))}
    </div>
  )
}

function TrailUnit({
  item,
  onComplete,
}: {
  item: TrailItem
  onComplete: (id: string) => void
}) {
  const [scope, animate] = useAnimate()

  useEffect(() => {
    const sequence = item.animationSequence.map((segment: TrailSegment) => [
      scope.current,
      ...segment,
    ]) as AnimationSequence

    animate(sequence).then(() => {
      onComplete(item.id)
    })
  }, [])

  return (
    <motion.div
      ref={scope}
      style={{
        position: "absolute",
        left: item.x,
        top: item.y,
        rotate: item.rotation,
        pointerEvents: "none",
      }}
    >
      {item.child}
    </motion.div>
  )
}

export { ImageTrail }

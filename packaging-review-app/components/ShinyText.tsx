"use client"

interface ShinyTextProps {
  text: string
  speed?: number
  delay?: number
  color?: string
  shineColor?: string
  spread?: number
  direction?: "left" | "right"
  yoyo?: boolean
  pauseOnHover?: boolean
  disabled?: boolean
  className?: string
}

function ShinyText({
  text,
  speed = 2,
  delay = 0,
  color = "#b5b5b5",
  shineColor = "#ffffff",
  spread = 120,
  direction = "left",
  yoyo = false,
  pauseOnHover = false,
  disabled = false,
  className = "",
}: ShinyTextProps) {
  if (disabled) {
    return <span className={className}>{text}</span>
  }

  const animDirection = direction === "left" ? "normal" : "reverse"
  const animName = yoyo ? "shiny-yoyo" : "shiny"
  const duration = (10 - Math.min(speed, 9)) * 0.8 + 0.5

  return (
    <span
      className={className}
      style={{
        backgroundImage: `linear-gradient(
          110deg,
          ${color} 0%,
          ${color} ${100 - spread / 3}%,
          ${shineColor} ${100 - spread / 4}%,
          ${color} ${100 - spread / 6}%,
          ${color} 100%
        )`,
        backgroundSize: `${spread * 3}% 100%`,
        backgroundClip: "text",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        animation: `${animName} ${duration}s linear infinite`,
        animationDelay: `${delay}s`,
        animationDirection: animDirection,
        animationPlayState: "running",
        display: "inline-block",
      }}
      onMouseEnter={
        pauseOnHover
          ? (e) => {
              ;(e.target as HTMLElement).style.animationPlayState = "paused"
            }
          : undefined
      }
      onMouseLeave={
        pauseOnHover
          ? (e) => {
              ;(e.target as HTMLElement).style.animationPlayState = "running"
            }
          : undefined
      }
    >
      <style>{`
        @keyframes shiny {
          0% { background-position: ${spread * 3}% 0; }
          100% { background-position: 0% 0; }
        }
        @keyframes shiny-yoyo {
          0% { background-position: ${spread * 3}% 0; }
          50% { background-position: 0% 0; }
          100% { background-position: ${spread * 3}% 0; }
        }
      `}</style>
      {text}
    </span>
  )
}

export { ShinyText }

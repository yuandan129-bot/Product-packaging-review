"use client"

import { motion } from "motion/react"

interface HoverTextProps {
  text: string
  className?: string
}

function HoverText({ text, className = "" }: HoverTextProps) {
  return (
    <motion.span
      className={className}
      style={{ display: "inline-block", cursor: "pointer" }}
      whileHover="hover"
      initial="initial"
    >
      {text.split("").map((char, index) => (
        <motion.span
          key={index}
          style={{ display: "inline-block" }}
          variants={{
            initial: {
              y: 0,
              scale: 1,
            },
            hover: {
              y: -4,
              scale: 1.2,
              transition: {
                type: "spring",
                stiffness: 300,
                damping: 15,
                delay: index * 0.03,
              },
            },
          }}
        >
          {char === " " ? " " : char}
        </motion.span>
      ))}
    </motion.span>
  )
}

export { HoverText }

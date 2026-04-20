'use client'
import { useEffect, useRef, useState } from 'react'
import { motion, useSpring, useTransform } from 'framer-motion'

type SpotlightProps = {
  size?: number
}

export function Spotlight({ size = 600 }: SpotlightProps) {
  const [visible, setVisible] = useState(false)
  const mouseX = useSpring(0, { bounce: 0, stiffness: 300, damping: 30 })
  const mouseY = useSpring(0, { bounce: 0, stiffness: 300, damping: 30 })

  const left = useTransform(mouseX, (x) => `${x - size / 2}px`)
  const top = useTransform(mouseY, (y) => `${y - size / 2}px`)

  const parentRef = useRef<HTMLElement | null>(null)
  const divRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Track relative to our parent container (already positioned)
    const parent = divRef.current?.parentElement
    if (parent) parentRef.current = parent

    function onMove(e: MouseEvent) {
      const p = parentRef.current
      if (!p) return
      const rect = p.getBoundingClientRect()
      mouseX.set(e.clientX - rect.left)
      mouseY.set(e.clientY - rect.top)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseenter', () => setVisible(true))
    window.addEventListener('mousemove', () => setVisible(true))
    return () => window.removeEventListener('mousemove', onMove)
  }, [mouseX, mouseY])

  return (
    <motion.div
      ref={divRef}
      className="pointer-events-none absolute rounded-full z-10"
      animate={{ opacity: visible ? 1 : 0 }}
      style={{
        width: size,
        height: size,
        left,
        top,
        background: 'radial-gradient(circle at center, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.07) 40%, transparent 70%)',
        filter: 'blur(24px)',
      }}
    />
  )
}

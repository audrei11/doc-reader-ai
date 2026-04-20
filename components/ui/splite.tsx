'use client'

import { useEffect, useRef } from 'react'

interface SplineSceneProps {
  scene: string
  className?: string
}

export function SplineScene({ scene, className }: SplineSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let app: { dispose?: () => void } | null = null

    async function init() {
      if (!canvasRef.current) return
      const { Application } = await import('@splinetool/runtime')
      app = new Application(canvasRef.current)
      await (app as { load: (url: string) => Promise<void> }).load(scene)
    }

    init().catch(console.error)

    return () => {
      if (app?.dispose) app.dispose()
    }
  }, [scene])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}

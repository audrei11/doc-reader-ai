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

    function forwardPointer(e: PointerEvent) {
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: false,
        clientX: e.clientX,
        clientY: e.clientY,
        screenX: e.screenX,
        screenY: e.screenY,
        movementX: e.movementX,
        movementY: e.movementY,
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        isPrimary: e.isPrimary,
      }))
      canvas.dispatchEvent(new MouseEvent('mousemove', {
        bubbles: false,
        clientX: e.clientX,
        clientY: e.clientY,
      }))
    }

    window.addEventListener('pointermove', forwardPointer)

    return () => {
      window.removeEventListener('pointermove', forwardPointer)
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

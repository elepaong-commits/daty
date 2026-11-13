import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from 'react'

const MAX_SCALE = 4
const DOUBLE_TAP_SCALE = 2.5
const DOUBLE_TAP_MS = 300
const DOUBLE_TAP_SLOP = 24

interface Transform {
  scale: number
  x: number
  y: number
}

const NONE: Transform = { scale: 1, x: 0, y: 0 }

/**
 * Pinch, double-tap and (on desktop) ctrl-wheel zoom for one photo in the viewer; one finger pans a zoomed
 * photo. While not zoomed, single-finger swipes stay with the strip around it (`touch-action: pan-x`).
 * `reset` puts it back, e.g. when the photo scrolls out of view.
 */
export function useZoom(onZoomChange: (zoomed: boolean) => void) {
  const ref = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState<Transform>(NONE)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ distance: number; start: Transform; center: { x: number; y: number } } | null>(null)
  const lastTap = useRef<{ time: number; x: number; y: number } | null>(null)
  const lastPointerType = useRef('')
  // Fingers down: the photo follows them without easing.
  const [held, setHeld] = useState(false)
  const zoomed = transform.scale > 1.01

  useEffect(() => {
    onZoomChange(zoomed)
  }, [zoomed]) // eslint-disable-line react-hooks/exhaustive-deps -- report changes only

  /** A point on screen relative to the photo's center. */
  const fromCenter = (clientX: number, clientY: number) => {
    const box = ref.current!.getBoundingClientRect()
    return { x: clientX - box.left - box.width / 2, y: clientY - box.top - box.height / 2 }
  }

  /** Keeps the photo covering its box: no panning past its edges. */
  const clamp = ({ scale, x, y }: Transform): Transform => {
    if (scale <= 1) return NONE
    const box = ref.current!.getBoundingClientRect()
    const maxX = ((scale - 1) * box.width) / 2
    const maxY = ((scale - 1) * box.height) / 2
    return { scale, x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) }
  }

  /** Zooms `from` to `scale`, keeping the point `at` (from center) where it is on screen. */
  const zoomAround = (from: Transform, scale: number, at: { x: number; y: number }) => {
    const s = Math.max(1, Math.min(MAX_SCALE, scale))
    const k = s / from.scale
    return clamp({ scale: s, x: at.x - (at.x - from.x) * k, y: at.y - (at.y - from.y) * k })
  }

  function onPointerDown(e: PointerEvent) {
    lastPointerType.current = e.pointerType
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    setHeld(true)
    if (zoomed || pointers.current.size === 2) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // A pointer the browser no longer tracks; the gesture still works without capture.
      }
    }
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }]
      pinch.current = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        start: transform,
        center: fromCenter((a.x + b.x) / 2, (a.y + b.y) / 2),
      }
    }
  }

  function onPointerMove(e: PointerEvent) {
    const previous = pointers.current.get(e.pointerId)
    if (!previous) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }]
      const ratio = Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.distance
      setTransform(zoomAround(pinch.current.start, pinch.current.start.scale * ratio, pinch.current.center))
    } else if (zoomed && pointers.current.size === 1) {
      setTransform((t) => clamp({ ...t, x: t.x + e.clientX - previous.x, y: t.y + e.clientY - previous.y }))
    }
  }

  function onPointerUp(e: PointerEvent) {
    const moved = pointers.current.get(e.pointerId)
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (pointers.current.size === 0) setHeld(false)
    if (e.pointerType !== 'touch' || !moved || e.type === 'pointercancel') return
    // Two quick taps in about the same place: zoom in there, or back out.
    const tap = { time: e.timeStamp, x: e.clientX, y: e.clientY }
    const last = lastTap.current
    if (last && tap.time - last.time < DOUBLE_TAP_MS && Math.hypot(tap.x - last.x, tap.y - last.y) < DOUBLE_TAP_SLOP) {
      lastTap.current = null
      toggleAt(tap.x, tap.y)
    } else {
      lastTap.current = tap
    }
  }

  function toggleAt(clientX: number, clientY: number) {
    setTransform((t) => (t.scale > 1.01 ? NONE : zoomAround(t, DOUBLE_TAP_SCALE, fromCenter(clientX, clientY))))
  }

  function onWheel(e: WheelEvent) {
    // A trackpad pinch arrives as a wheel with ctrlKey; a plain wheel is left to scroll.
    if (!e.ctrlKey) return
    setTransform((t) => zoomAround(t, t.scale * Math.exp(-e.deltaY / 100), fromCenter(e.clientX, e.clientY)))
  }

  return {
    ref,
    zoomed,
    reset: () => setTransform(NONE),
    bind: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onWheel,
      // Mouse users double-click; touch double-taps are counted above.
      onDoubleClick: (e: { clientX: number; clientY: number }) => lastPointerType.current !== 'touch' && toggleAt(e.clientX, e.clientY),
    },
    style: {
      transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
      touchAction: zoomed ? 'none' : 'pan-x',
      transition: held ? 'none' : 'transform 0.2s ease-out',
    } as const,
  }
}

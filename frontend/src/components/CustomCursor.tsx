import { useEffect, useRef } from 'react'

function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let mouseX = 0
    let mouseY = 0
    let ringX = 0
    let ringY = 0
    let animationFrame = 0

    document.documentElement.classList.add('custom-cursor-active')

    const showCursor = () => {
      dotRef.current?.classList.add('cursor-visible')
      ringRef.current?.classList.add('cursor-visible')
    }

    const hideCursor = () => {
      dotRef.current?.classList.remove('cursor-visible')
      ringRef.current?.classList.remove('cursor-visible')
    }

    const handleMouseMove = (event: MouseEvent) => {
      mouseX = event.clientX
      mouseY = event.clientY
      showCursor()

      if (dotRef.current) {
        dotRef.current.style.left = `${mouseX}px`
        dotRef.current.style.top = `${mouseY}px`
      }
    }

    const animateRing = () => {
      ringX += (mouseX - ringX) * 0.18
      ringY += (mouseY - ringY) * 0.18

      if (ringRef.current) {
        ringRef.current.style.left = `${ringX}px`
        ringRef.current.style.top = `${ringY}px`
      }

      animationFrame = requestAnimationFrame(animateRing)
    }

    const handleMouseOver = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      const interactive = target.closest(
        'button, a, input, textarea, select, [role="button"], [role="tab"]',
      )

      if (!interactive) return

      dotRef.current?.classList.add('cursor-hover')
      ringRef.current?.classList.add('cursor-hover')
    }

    const handleMouseOut = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      const interactive = target.closest(
        'button, a, input, textarea, select, [role="button"], [role="tab"]',
      )

      if (!interactive) return

      dotRef.current?.classList.remove('cursor-hover')
      ringRef.current?.classList.remove('cursor-hover')
    }

    const handleMouseDown = () => {
      dotRef.current?.classList.add('cursor-click')
      ringRef.current?.classList.add('cursor-click')
    }

    const handleMouseUp = () => {
      dotRef.current?.classList.remove('cursor-click')
      ringRef.current?.classList.remove('cursor-click')
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('blur', hideCursor)
    document.addEventListener('mouseleave', hideCursor)
    document.addEventListener('mouseover', handleMouseOver)
    document.addEventListener('mouseout', handleMouseOut)

    animationFrame = requestAnimationFrame(animateRing)

    return () => {
      document.documentElement.classList.remove('custom-cursor-active')
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('blur', hideCursor)
      document.removeEventListener('mouseleave', hideCursor)
      document.removeEventListener('mouseover', handleMouseOver)
      document.removeEventListener('mouseout', handleMouseOut)
      cancelAnimationFrame(animationFrame)
    }
  }, [])

  return (
    <>
      <div ref={ringRef} className="secure-cursor-ring" />
      <div ref={dotRef} className="secure-cursor" />
    </>
  )
}

export default CustomCursor

import { useLayoutEffect, useRef, useState } from 'react'

/**
 * 엘리먼트의 렌더링된 높이(테두리 포함)를 실시간으로 잰다. 고정(position: fixed) 헤더 밑에
 * 콘텐츠가 가리지 않도록 띄울 여백을 계산할 때 쓴다 — 헤더 높이가 그룹 이름 줄바꿈, 멤버 수 등에 따라
 * 달라지므로 고정값 대신 실제 높이를 잰다.
 * jsdom처럼 ResizeObserver가 없는 환경(테스트)에서는 조용히 0을 반환한다.
 */
export function useElementHeight<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [height, setHeight] = useState(0)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const measure = () => setHeight(el.getBoundingClientRect().height)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return [ref, height]
}

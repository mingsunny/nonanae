import { useEffect, useRef, useState } from 'react'
import Button from '../common/Button'
import { markOnboardingSeen, ONBOARDING_SLIDES } from '../../domain/onboarding'
import styles from './OnboardingGuide.module.css'

/**
 * 첫 진입 가이드 — 카드뉴스처럼 한 장씩 넘겨 보는 전체 화면 창.
 * 손가락으로 옆으로 밀거나(스크롤 스냅), 아래 이전/다음 버튼, 키보드 ←/→ 로 넘긴다.
 */
export default function OnboardingGuide({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)
  const last = ONBOARDING_SLIDES.length - 1

  function goTo(next: number) {
    const clamped = Math.max(0, Math.min(last, next))
    setIndex(clamped)
    const track = trackRef.current
    // 테스트 환경(jsdom)에는 레이아웃과 scrollTo가 없다
    if (track && track.clientWidth > 0 && typeof track.scrollTo === 'function') {
      track.scrollTo({ left: clamped * track.clientWidth, behavior: 'smooth' })
    }
  }

  // 손가락으로 밀어서 넘긴 경우 지금 보이는 카드 번호를 따라간다
  function onScroll() {
    const track = trackRef.current
    if (!track || track.clientWidth === 0) return
    const current = Math.round(track.scrollLeft / track.clientWidth)
    if (current !== index) setIndex(current)
  }

  function close() {
    markOnboardingSeen()
    onClose()
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') goTo(index + 1)
      else if (e.key === 'ArrowLeft') goTo(index - 1)
      else if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="노나내 사용 가이드">
      <div className={styles.top}>
        <span className={styles.counter} aria-live="polite">
          {index + 1} / {ONBOARDING_SLIDES.length}
        </span>
        <button type="button" className={styles.skip} onClick={close}>
          건너뛰기
        </button>
      </div>

      <div className={styles.track} ref={trackRef} onScroll={onScroll}>
        {ONBOARDING_SLIDES.map((slide, i) => (
          <section key={slide.title} className={styles.slide} aria-hidden={i !== index}>
            {slide.image ? (
              <div className={styles.phone}>
                <img
                  src={slide.image.src}
                  alt={slide.image.alt}
                  style={{ objectPosition: `50% ${slide.image.pos ?? '0%'}` }}
                  loading={i <= 1 ? 'eager' : 'lazy'}
                />
              </div>
            ) : (
              <div className={styles.hero}>
                <img src="/intro/img/logo.png" alt="노나내" width={150} height={97} />
              </div>
            )}
            <div className={styles.text}>
              <h2 className={styles.title}>{slide.title}</h2>
              <p className={styles.body}>{slide.body}</p>
            </div>
          </section>
        ))}
      </div>

      <div className={styles.dots} aria-hidden="true">
        {ONBOARDING_SLIDES.map((slide, i) => (
          <span key={slide.title} className={i === index ? styles.dotActive : styles.dot} />
        ))}
      </div>

      <div className={styles.nav}>
        {index > 0 ? (
          <Button variant="outline" onClick={() => goTo(index - 1)}>
            이전
          </Button>
        ) : (
          <span />
        )}
        {index < last ? (
          <Button onClick={() => goTo(index + 1)}>다음</Button>
        ) : (
          <Button onClick={close}>시작하기</Button>
        )}
      </div>
    </div>
  )
}

import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Svg({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const BackIcon = (p: IconProps) => (
  <Svg strokeWidth={2.4} {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Svg>
)
export const PlusIcon = (p: IconProps) => (
  <Svg strokeWidth={2.4} {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)
export const CloseIcon = (p: IconProps) => (
  <Svg strokeWidth={2.4} {...p}>
    <path d="M5 5l14 14M19 5 5 19" />
  </Svg>
)
export const CheckIcon = (p: IconProps) => (
  <Svg strokeWidth={3} {...p}>
    <path d="M4 12l6 6L20 6" />
  </Svg>
)
export const BellIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 8a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5z" />
    <path d="M9.5 17a2.5 2.5 0 0 0 5 0" />
  </Svg>
)
export const ReceiptIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 3h12v16l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3V3z" />
    <path d="M9 7.5h6M9 11h6" />
  </Svg>
)
export const TransferIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 8h10m0 0-3-3m3 3-3 3M17 16H7m0 0 3-3m-3 3 3 3" />
  </Svg>
)
export const BarsIcon = (p: IconProps) => (
  <Svg strokeWidth={2.4} {...p}>
    <path d="M6 20V14M12 20V9M18 20V5" />
  </Svg>
)
export const HomeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 11.5 12 4l8 7.5" />
    <path d="M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9" />
  </Svg>
)
export const UserIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.5 20c0-4 3.4-6.8 7.5-6.8s7.5 2.8 7.5 6.8" />
  </Svg>
)
export const KakaoIcon = ({ size = 13, ...rest }: IconProps) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" {...rest}>
    <path d="M12 3C6.48 3 2 6.48 2 10.78c0 2.75 1.83 5.16 4.58 6.54-.2.73-.73 2.66-.83 3.07-.13.5.18.5.39.36.16-.11 2.6-1.76 3.66-2.48.71.1 1.44.16 2.2.16 5.52 0 10-3.48 10-7.78S17.52 3 12 3z" />
  </svg>
)
export const EyeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
)
export const EyeOffIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.2 3.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />
  </Svg>
)

import type { ButtonHTMLAttributes } from 'react'
import styles from './Button.module.css'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline'
}

export default function Button({ variant = 'primary', className, ...rest }: Props) {
  const classes = [styles.button, styles[variant], className].filter(Boolean).join(' ')
  return <button type="button" className={classes} {...rest} />
}

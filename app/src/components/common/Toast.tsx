import { useToastStore } from '../../store/toastStore'
import styles from './Toast.module.css'

/** 앱 최상단에 한 번만 두는 토스트 표시부. 문구는 showToast(store/toastStore)로 띄운다. */
export default function ToastHost() {
  const message = useToastStore((s) => s.message)
  const seq = useToastStore((s) => s.seq)
  if (message === null) return null
  return (
    <div key={seq} className={styles.toast} role="status">
      {message}
    </div>
  )
}

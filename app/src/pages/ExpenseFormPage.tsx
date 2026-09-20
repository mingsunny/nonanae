import { useParams } from 'react-router-dom'
import PagePlaceholder from '../components/common/PagePlaceholder'

export default function ExpenseFormPage() {
  const { expenseId } = useParams()
  const isEdit = expenseId !== undefined
  return (
    <PagePlaceholder
      spec="11"
      title={isEdit ? '지출 수정' : '지출 추가'}
      detail={isEdit ? `expenseId: ${expenseId}` : undefined}
    />
  )
}

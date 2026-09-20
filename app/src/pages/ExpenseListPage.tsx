import { Link } from 'react-router-dom'
import CategoryBadge from '../components/common/CategoryBadge'
import EmptyState from '../components/common/EmptyState'
import { PlusIcon } from '../components/common/icons'
import { dateLabel, won } from '../lib/format'
import { paths } from '../routes/paths'
import type { GroupDetail } from '../domain/types'
import { useCurrentGroup, useGroupView } from '../store/hooks'
import styles from './ExpenseListPage.module.css'

/** 08. 그룹 지출 내역 — 사용 날짜별로 묶어 최신 날짜부터. 같은 날 안에서는 최근에 등록한 지출이 위. */
export default function ExpenseListPage() {
  const group = useCurrentGroup()
  if (!group) return null
  return <ExpenseList group={group} />
}

function ExpenseList({ group }: { group: GroupDetail }) {
  const { nameOf } = useGroupView(group)
  const isEmpty = group.expenses.length === 0

  // 최근에 등록한 지출이 위로: 등록 시각(createdAt) 내림차순으로 먼저 줄 세운 뒤 날짜별로 묶는다.
  // 등록 시각이 같으면 나중에 들어온 것이 위. 수정해도 createdAt은 그대로라 자리가 바뀌지 않는다.
  const newestFirst = group.expenses
    .map((expense, index) => ({ expense, index }))
    .sort((a, b) =>
      a.expense.createdAt < b.expense.createdAt ? 1 : a.expense.createdAt > b.expense.createdAt ? -1 : b.index - a.index,
    )
    .map(({ expense }) => expense)

  const byDate = new Map<string, typeof group.expenses>()
  for (const expense of newestFirst) {
    byDate.set(expense.spentAt, [...(byDate.get(expense.spentAt) ?? []), expense])
  }
  const dates = [...byDate.keys()].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))

  return (
    <>
      {isEmpty && group.members.length === 1 && <EmptyState>정산할 친구를 초대해주세요.</EmptyState>}
      {isEmpty && group.members.length > 1 && (
        <EmptyState icon="＋">
          아직 등록된 지출이 없어요.
          <br />
          첫 지출을 추가해보세요.
        </EmptyState>
      )}

      {dates.map((date) => (
        <section key={date}>
          <div className={styles.dateLabel}>{dateLabel(date)}</div>
          {byDate.get(date)!.map((expense) => {
            const partial = expense.participants.length < group.members.length
            return (
              <Link
                key={expense.id}
                to={paths.expenseEdit(group.id, expense.id)}
                className={styles.receipt}
              >
                <CategoryBadge category={expense.category} />
                <div className={styles.info}>
                  <div className={styles.title}>{expense.title}</div>
                  <div className={styles.sub}>
                    {nameOf(expense.paidBy)} 결제 · {expense.participants.length}명 나눔
                    {partial ? ' (일부)' : ''}
                  </div>
                </div>
                <div className={`${styles.amount} num`}>{won(expense.amount)}</div>
              </Link>
            )
          })}
        </section>
      ))}

      <div className={styles.fabWrap}>
        <Link to={paths.expenseNew(group.id)} className={styles.fab} aria-label="지출 추가">
          <PlusIcon size={22} />
        </Link>
      </div>
    </>
  )
}

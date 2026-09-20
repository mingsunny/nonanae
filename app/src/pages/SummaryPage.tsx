import EmptyState from '../components/common/EmptyState'
import Avatar from '../components/common/Avatar'
import { CATEGORY_COLORS } from '../domain/constants'
import { computeBalances, groupTotal, totalsByCategory } from '../domain/settlement'
import type { Category, GroupDetail } from '../domain/types'
import { won } from '../lib/format'
import { useCurrentGroup, useGroupView } from '../store/hooks'
import styles from './SummaryPage.module.css'

/** 10. 그룹 요약 — 카테고리별 비중과 인원별 결제/잔액. 읽기 전용. */
export default function SummaryPage() {
  const group = useCurrentGroup()
  if (!group) return null
  return <Summary group={group} />
}

function Summary({ group }: { group: GroupDetail }) {
  const { nameOf, isMe } = useGroupView(group)
  const isEmpty = group.expenses.length === 0

  const total = groupTotal(group.expenses)
  const categories = (Object.entries(totalsByCategory(group.expenses)) as [Category, number][])
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1])

  const { paid, balance } = computeBalances(
    group.members.map((m) => m.id),
    group.expenses,
  )

  return (
    <>
      <div className={styles.label}>카테고리별</div>
      <div className={styles.card}>
        {isEmpty ? (
          <EmptyState>아직 등록된 지출이 없어요.</EmptyState>
        ) : (
          <>
            <div className={styles.stackbar}>
              {categories.map(([category, amount]) => (
                <div
                  key={category}
                  className={styles.seg}
                  style={{ width: `${(amount / total) * 100}%`, background: CATEGORY_COLORS[category] }}
                />
              ))}
            </div>
            {categories.map(([category, amount]) => (
              <div key={category} className={styles.legend}>
                <span className={styles.swatch} style={{ background: CATEGORY_COLORS[category] }} />
                <span className={styles.legendName}>{category}</span>
                <span className={`${styles.legendAmount} num`}>{won(amount)}</span>
                <span className={`${styles.pct} num`}>{Math.round((amount / total) * 100)}%</span>
              </div>
            ))}
          </>
        )}
      </div>

      <div className={styles.label}>인원별</div>
      <div className={styles.card}>
        {isEmpty ? (
          <EmptyState>아직 등록된 지출이 없어요.</EmptyState>
        ) : (
          group.members.map((member) => {
            const net = balance[member.id] ?? 0
            const tone = net > 0 ? styles.plus : net < 0 ? styles.minus : styles.zero
            return (
              <div key={member.id} className={styles.person}>
                <Avatar name={nameOf(member.id)} />
                <div className={styles.personInfo}>
                  <div className={styles.personName}>
                    {nameOf(member.id)}
                    {isMe(member.id) ? ' (나)' : ''}
                  </div>
                  <div className={`${styles.personSub} num`}>결제 {won(paid[member.id] ?? 0)}</div>
                </div>
                <div className={styles.balance}>
                  <div className={`${styles.balanceAmount} ${tone} num`}>
                    {net === 0 ? '—' : won(Math.abs(net))}
                  </div>
                  <div className={styles.personSub}>
                    {net > 0 ? '받을 돈' : net < 0 ? '보낼 돈' : '정산 완료'}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </>
  )
}

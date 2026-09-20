import { useState } from 'react'
import EmptyState from '../components/common/EmptyState'
import { memberBankAccount } from '../domain/members'
import { computeBalances, computeTransfers } from '../domain/settlement'
import type { GroupDetail, Transfer } from '../domain/types'
import { copyText } from '../lib/clipboard'
import { won } from '../lib/format'
import { useAppStore } from '../store/appStore'
import { useCurrentGroup, useGroupView } from '../store/hooks'
import { showToast } from '../store/toastStore'
import styles from './SettlePage.module.css'

/** 09. 그룹 정산 — 최소 송금 결과를 보여주고, 내가 보낼 계좌는 탭해서 복사. 지출이 바뀔 때마다 실시간 재계산. */
export default function SettlePage() {
  const group = useCurrentGroup()
  if (!group) return null
  return <Settle group={group} />
}

function Settle({ group }: { group: GroupDetail }) {
  const usersById = useAppStore((s) => s.usersById)
  const { nameOf, me, isMe } = useGroupView(group)
  const [pressed, setPressed] = useState<string | null>(null)

  if (group.expenses.length === 0) return <EmptyState>아직 등록된 지출이 없어요.</EmptyState>

  const { balance } = computeBalances(
    group.members.map((m) => m.id),
    group.expenses,
  )
  const transfers = computeTransfers(balance)
  if (transfers.length === 0) {
    return (
      <EmptyState icon="✓">
        정산할 금액이 없어요.
        <br />
        모두 정확히 나눠 냈어요.
      </EmptyState>
    )
  }

  // 내가 보낼 송금은 금액 내림차순으로 맨 위, 나머지는 이름순 (09 §3.4)
  const isMine = (t: Transfer) => me !== undefined && t.from === me.id
  const mine = transfers.filter(isMine).sort((a, b) => b.amount - a.amount)
  const others = transfers
    .filter((t) => !isMine(t))
    .sort(
      (a, b) =>
        nameOf(a.from).localeCompare(nameOf(b.from), 'ko') ||
        nameOf(a.to).localeCompare(nameOf(b.to), 'ko'),
    )

  async function copyAccount(key: string, account: string) {
    const ok = await copyText(account)
    showToast(ok ? '계좌번호가 복사되었습니다' : '복사하지 못했어요. 계좌: ' + account)
    setPressed(key)
    setTimeout(() => setPressed(null), 350)
  }

  function renderRow(t: Transfer, showAccount: boolean) {
    const key = `${t.from}-${t.to}`
    const receiver = group.members.find((m) => m.id === t.to)!
    const bankAccount = memberBankAccount(receiver, usersById)
    return (
      <div key={key} className={pressed === key ? `${styles.row} ${styles.press}` : styles.row}>
        <div className={styles.top}>
          <span className={styles.name}>
            {nameOf(t.from)}
            {isMe(t.from) ? ' (나)' : ''}
          </span>
          <span className={styles.arrow}>→</span>
          <span className={styles.name}>
            {nameOf(t.to)}
            {isMe(t.to) ? ' (나)' : ''}
          </span>
          <span className={`${styles.amount} num`}>{won(t.amount)}</span>
        </div>

        {/* 계좌는 내가 보낼 송금에만 노출. 다른 사람 간 송금은 복사할 필요가 없어 아예 렌더링하지 않음 */}
        {showAccount && bankAccount && (
          <button
            type="button"
            className={styles.account}
            onClick={() => copyAccount(key, bankAccount.account)}
          >
            <span className={`${styles.accountText} num`}>
              {bankAccount.bank} {bankAccount.account}
            </span>
            <span className={styles.hint}>탭해서 계좌번호 복사</span>
          </button>
        )}
        {/* 대기 중 멤버·게스트는 계좌가 없어 정상적으로 발생 — 복사 UI 비활성화 (09 §6) */}
        {showAccount && !bankAccount && (
          <div className={`${styles.account} ${styles.noAccount}`}>
            <span className={styles.missing}>
              등록된 계좌가 없어요. {nameOf(t.to)}님에게 직접 확인해주세요
            </span>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <p className={styles.guide}>
        가장 적은 횟수로 정산할 수 있도록 계산했어요. 내가 보낼 계좌는 탭하면 복사돼요. 지출을
        등록하면 정산 결과도 실시간으로 바로 반영돼요.
      </p>
      {mine.map((t) => renderRow(t, true))}
      {others.map((t) => renderRow(t, false))}
    </>
  )
}

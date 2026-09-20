import { useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import Button from '../components/common/Button'
import fields from '../components/common/Field.module.css'
import { BackIcon, CheckIcon } from '../components/common/icons'
import { CATEGORY_COLORS } from '../domain/constants'
import { checkSplit, customSharesFromExpense, finalizeParticipants, prefillShares } from '../domain/expenseForm'
import { splitEqual } from '../domain/settlement'
import { CATEGORIES, SPLIT_TYPES } from '../domain/types'
import type {
  AmountByMember,
  Category,
  ExpenseInput,
  ExpenseWithParticipants,
  GroupDetail,
  SplitType,
} from '../domain/types'
import { todayIso, won } from '../lib/format'
import { paths } from '../routes/paths'
import { useAppStore } from '../store/appStore'
import { useCurrentGroup, useGroupView } from '../store/hooks'
import { showToast } from '../store/toastStore'
import styles from './ExpenseFormPage.module.css'

const SPLIT_LABELS: Record<SplitType, string> = { equal: '균등', ratio: '비율', amount: '금액' }
/** 영수증 사진 용량 제한 (목업은 localStorage에 저장하므로 작게 제한) */
const MAX_RECEIPT_BYTES = 2 * 1024 * 1024

/** 11. 지출 추가 / 수정 — 같은 화면을 재사용하며 :expenseId가 있으면 수정 모드. */
export default function ExpenseFormPage() {
  const { groupId = '', expenseId } = useParams()
  const group = useCurrentGroup()

  if (!group) return <Navigate to={paths.groups} replace />
  const editing = expenseId ? group.expenses.find((e) => e.id === expenseId) : undefined
  // 이미 삭제됐거나 없는 지출을 수정하려는 경우
  if (expenseId && !editing) return <Navigate to={paths.groupExpenses(groupId)} replace />

  return <ExpenseForm key={editing?.id ?? 'new'} group={group} editing={editing} />
}

function ExpenseForm({ group, editing }: { group: GroupDetail; editing: ExpenseWithParticipants | undefined }) {
  const navigate = useNavigate()
  const addExpense = useAppStore((s) => s.addExpense)
  const editExpense = useAppStore((s) => s.editExpense)
  const removeExpense = useAppStore((s) => s.removeExpense)
  const { nameOf, me, isMe, isPending } = useGroupView(group)

  const [amountText, setAmountText] = useState(editing ? String(editing.amount) : '')
  const [title, setTitle] = useState(editing?.title ?? '')
  const [spentAt, setSpentAt] = useState(editing?.spentAt ?? todayIso())
  const [category, setCategory] = useState<Category>(editing?.category ?? '식비')
  const [receipt, setReceipt] = useState<string | null>(editing?.receiptImageUrl ?? null)
  const [paidBy, setPaidBy] = useState(editing?.paidBy ?? me?.id ?? group.members[0].id)
  const [splitType, setSplitType] = useState<SplitType>(editing?.splitType ?? 'equal')
  const [participantIds, setParticipantIds] = useState<string[]>(
    editing ? editing.participants.map((p) => p.memberId) : group.members.map((m) => m.id),
  )
  // 비율/금액 입력칸의 원문. 숫자로 바로 바꾸면 입력 중에 칸을 비울 수 없어서 문자열로 들고 있음
  const [shareTexts, setShareTexts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(editing ? customSharesFromExpense(editing) : {}).map(([id, v]) => [id, String(v)]),
    ),
  )
  const [submitting, setSubmitting] = useState(false)

  const amount = parseInt(amountText || '0', 10) || 0

  // 입력 원문 → 숫자. 금액(원)은 소수가 없으니 즉시 정수로 정리하고, 비율(%)은 소수 허용.
  const customShares = useMemo<AmountByMember>(
    () =>
      Object.fromEntries(
        participantIds.map((id) => {
          const parsed = parseFloat(shareTexts[id] ?? '') || 0
          return [id, splitType === 'amount' ? Math.round(parsed) : parsed]
        }),
      ),
    [participantIds, shareTexts, splitType],
  )

  const equalShares = useMemo(() => splitEqual(amount, participantIds), [amount, participantIds])
  const split = checkSplit(splitType, amount, participantIds, customShares)
  const canSubmit = amount > 0 && title.trim().length > 0 && spentAt !== '' && participantIds.length > 0 && split.ok

  function fillShares(mode: SplitType, ids: string[]) {
    if (mode === 'equal') return
    const prefilled = prefillShares(mode, amount, ids)
    setShareTexts(Object.fromEntries(Object.entries(prefilled).map(([id, v]) => [id, String(v)])))
  }

  function pickSplitType(mode: SplitType) {
    setSplitType(mode)
    fillShares(mode, participantIds)
  }

  function toggleParticipant(memberId: string) {
    const selected = participantIds.includes(memberId)
    if (selected && participantIds.length === 1) {
      showToast('최소 1명은 선택되어야 해요')
      return
    }
    // 그룹 멤버 순서를 유지해서 저장 순서가 일정하게
    const next = group.members
      .map((m) => m.id)
      .filter((id) => (id === memberId ? !selected : participantIds.includes(id)))
    setParticipantIds(next)
    fillShares(splitType, next)
  }

  function onReceiptChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_RECEIPT_BYTES) {
      showToast('사진 용량이 너무 커요. 2MB 이하로 골라주세요')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setReceipt(typeof reader.result === 'string' ? reader.result : null)
    reader.onerror = () => showToast('사진을 불러오지 못했어요. 다시 시도해주세요')
    reader.readAsDataURL(file)
  }

  async function submit() {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    const input: ExpenseInput = {
      groupId: group.id,
      paidBy,
      title: title.trim(),
      amount,
      category,
      receiptImageUrl: receipt,
      splitType,
      spentAt,
      participants: finalizeParticipants(splitType, amount, participantIds, customShares),
    }
    try {
      if (editing) await editExpense(editing.id, input)
      else await addExpense(input)
      showToast(editing ? '지출이 수정되었습니다' : '지출이 등록되었습니다')
      navigate(paths.groupExpenses(group.id))
    } catch (error) {
      showToast(error instanceof Error ? error.message : '저장하지 못했어요')
      setSubmitting(false)
    }
  }

  async function remove() {
    if (!editing) return
    if (!window.confirm('이 지출을 삭제할까요?')) return
    try {
      await removeExpense(editing.id)
      showToast('지출이 삭제되었습니다')
      navigate(paths.groupExpenses(group.id))
    } catch (error) {
      showToast(error instanceof Error ? error.message : '삭제하지 못했어요')
    }
  }

  const memberLabel = (memberId: string) => {
    const member = group.members.find((m) => m.id === memberId)!
    return `${nameOf(memberId)}${isMe(memberId) ? ' (나)' : ''}${isPending(member) ? ' (대기중)' : ''}`
  }

  return (
    <div className={styles.page}>
      {/* 헤더 back: 입력 중인 내용은 저장하지 않고 08로 복귀 */}
      <div className={styles.topbar}>
        <Link to={paths.groupExpenses(group.id)} className={styles.back} aria-label="지출 내역으로">
          <BackIcon size={14} />
        </Link>
        <h1 className={styles.title}>{editing ? '지출 수정' : '지출 추가'}</h1>
      </div>

      <div className={styles.body}>
        <label className={fields.label} htmlFor="ex-amount">
          사용 금액
        </label>
        <input
          id="ex-amount"
          className={`${fields.input} num`}
          type="number"
          inputMode="numeric"
          min={0}
          placeholder="0"
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
        />

        <label className={fields.label} htmlFor="ex-title">
          항목명
        </label>
        <input
          id="ex-title"
          className={fields.input}
          type="text"
          placeholder="예) 흑돼지 저녁식사"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <label className={fields.label} htmlFor="ex-date">
          사용 날짜
        </label>
        <input
          id="ex-date"
          className={fields.input}
          type="date"
          value={spentAt}
          onChange={(e) => setSpentAt(e.target.value)}
        />

        <div className={fields.label}>카테고리</div>
        <div className={styles.chips} role="radiogroup" aria-label="카테고리">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={c === category}
              className={c === category ? `${styles.chip} ${styles.chipOn}` : styles.chip}
              style={c === category ? { background: CATEGORY_COLORS[c], borderColor: CATEGORY_COLORS[c] } : undefined}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>

        <div className={fields.label}>영수증 사진 (선택)</div>
        <label className={styles.upload}>
          {receipt && <img src={receipt} alt="영수증 미리보기" className={styles.preview} />}
          <span>{receipt ? '사진이 첨부되었어요 · 다시 선택하려면 누르세요' : '눌러서 사진 첨부하기'}</span>
          <input type="file" accept="image/*" onChange={onReceiptChange} />
        </label>

        <label className={fields.label} htmlFor="ex-payer">
          결제자
        </label>
        <select id="ex-payer" className={fields.select} value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
          {group.members.map((m) => (
            <option key={m.id} value={m.id}>
              {memberLabel(m.id)}
            </option>
          ))}
        </select>

        <div className={fields.label}>나누기 방식</div>
        <div className={styles.toggle} role="radiogroup" aria-label="나누기 방식">
          {SPLIT_TYPES.map((mode) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={mode === splitType}
              className={mode === splitType ? `${styles.opt} ${styles.optOn}` : styles.opt}
              onClick={() => pickSplitType(mode)}
            >
              {SPLIT_LABELS[mode]}
            </button>
          ))}
        </div>

        <div className={fields.label}>
          함께 사용한 인원 <span className={fields.hint}>(일부만 선택 가능)</span>
        </div>
        <div className={styles.people}>
          {group.members.map((m) => {
            const on = participantIds.includes(m.id)
            return (
              <div key={m.id} className={styles.person}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  className={styles.check}
                  onClick={() => toggleParticipant(m.id)}
                >
                  <span className={on ? `${styles.box} ${styles.boxOn}` : styles.box}>
                    {on && <CheckIcon size={11} stroke="#fff" />}
                  </span>
                  <span className={styles.personName}>{memberLabel(m.id)}</span>
                </button>
                <div className={styles.share}>
                  {splitType === 'equal' ? (
                    <span className={on ? `${styles.readonly} num` : `${styles.readonly} ${styles.off}`}>
                      {on ? won(equalShares[m.id] ?? 0) : '—'}
                    </span>
                  ) : (
                    <span className={styles.shareInput}>
                      <input
                        className={`${styles.shareField} num`}
                        type="number"
                        inputMode="decimal"
                        aria-label={`${nameOf(m.id)} ${splitType === 'ratio' ? '비율' : '금액'}`}
                        disabled={!on}
                        value={on ? (shareTexts[m.id] ?? '0') : '0'}
                        onChange={(e) => setShareTexts((prev) => ({ ...prev, [m.id]: e.target.value }))}
                      />
                      <span className={styles.unit}>{splitType === 'ratio' ? '%' : '원'}</span>
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* 비율/금액 모드: 합계가 목표값과 맞는지 실시간 안내 (일치=초록, 불일치=붉은색) */}
        {splitType !== 'equal' && (
          <div className={split.ok ? `${styles.summary} ${styles.ok}` : `${styles.summary} ${styles.bad}`} role="status">
            합계 {splitType === 'ratio' ? `${split.sum}%` : won(split.sum)} /{' '}
            {splitType === 'ratio' ? `${split.target}%` : won(split.target)}
          </div>
        )}

        <div className={styles.actions}>
          <Button disabled={!canSubmit || submitting} onClick={submit}>
            {editing ? '저장하기' : '지출 등록하기'}
          </Button>
        </div>

        {editing && (
          <div className={styles.remove}>
            <button type="button" className={styles.removeLink} onClick={remove}>
              이 지출 삭제하기
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

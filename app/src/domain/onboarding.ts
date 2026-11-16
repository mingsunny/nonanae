// 첫 진입 가이드(OnboardingGuide)의 카드 내용과 '이미 봤는지' 기록

/** 카드 한 장. 이미지는 소개 페이지(public/intro/img)의 화면 캡처를 같이 쓴다. pos = 세로 방향으로 보여 줄 위치 */
export interface OnboardingSlide {
  title: string
  body: string
  image?: { src: string; alt: string; pos?: string }
}

export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    title: '여행에서 함께 쓴 돈,\n가장 간단하게 나눠요',
    body: '그룹을 만들고 쓴 돈을 기록하면, 누가 누구에게 얼마를 보내면 되는지 계산해 줘요.',
  },
  {
    title: '여행마다 그룹을 만들어요',
    body: '그룹은 홈에 모여요. 새 지출이나 참여 요청은 알림 종으로 알려 줘요.',
    image: { src: '/intro/img/groups.jpg', alt: '그룹 목록 화면', pos: '0%' },
  },
  {
    title: '쓴 돈을 바로 기록해요',
    body: '오른쪽 아래 + 버튼으로 금액, 항목, 결제한 사람을 남기면 날짜별로 정리돼요.',
    image: { src: '/intro/img/expenses.jpg', alt: '그룹 지출 내역 화면', pos: '0%' },
  },
  {
    title: '나누는 방식을 골라요',
    body: '균등, 비율, 금액 중에서 고르고, 일부 인원만 함께 쓴 지출도 따로 나눌 수 있어요.',
    image: { src: '/intro/img/form.jpg', alt: '지출 추가 화면의 나누기 방식 선택', pos: '100%' },
  },
  {
    title: '누가 누구에게, 얼마를',
    body: '가장 적은 횟수로 정산하도록 계산해 줘요. 받는 사람의 계좌를 누르면 복사돼요.',
    image: { src: '/intro/img/settle.jpg', alt: '정산 결과 화면', pos: '0%' },
  },
  {
    title: '어디에 얼마 썼는지 한눈에',
    body: '카테고리별 비중과 사람마다 결제한 금액을 요약해서 보여 줘요.',
    image: { src: '/intro/img/summary.jpg', alt: '요약 화면', pos: '73%' },
  },
  {
    title: '초대 링크로 친구를 불러요',
    body: '링크를 받은 친구가 참여를 요청하고, 그룹장이 승인하면 함께 기록할 수 있어요.',
    image: { src: '/intro/img/join.jpg', alt: '그룹 초대 화면', pos: '0%' },
  },
]

const SEEN_KEY = 'nonanae.onboardingSeen'

/** 처음 들어온 사람인지. 저장소를 못 쓰는 환경(사생활 보호 모드 등)에서는 매번 보여 주지 않도록 '봤음'으로 친다 */
export function hasSeenOnboarding(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return true
  }
}

export function markOnboardingSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1')
  } catch {
    // 저장 못 해도 가이드는 닫힌다. 다음에 또 보일 뿐이다
  }
}

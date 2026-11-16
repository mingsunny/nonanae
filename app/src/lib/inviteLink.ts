import { copyText } from './clipboard'
import { isTossBuild } from './platform'
import { createTossShareLink, openTossShareSheet } from './toss'

/**
 * 초대 링크 보내기. 웹은 `https://…/join?code=…`을 클립보드에 복사하고,
 * 토스 미니앱은 토스 공유 링크(`intoss://…`)를 만들어 공유 시트를 연다(외부 웹 주소로 보내면 안 되는 정책).
 * @param appPath 앱 안 경로. 예: `/join?code=ABCDEF`
 * @param message 토스 공유 시트에 링크와 함께 보낼 문구
 */
export async function sendInviteLink(
  appPath: string,
  message: string,
): Promise<{ result: 'copied' | 'shared' | 'failed'; link: string }> {
  if (isTossBuild()) {
    try {
      const link = await createTossShareLink(appPath)
      await openTossShareSheet(`${message}\n${link}`)
      return { result: 'shared', link }
    } catch {
      return { result: 'failed', link: '' }
    }
  }
  const link = `${window.location.origin}${appPath}`
  return { result: (await copyText(link)) ? 'copied' : 'failed', link }
}

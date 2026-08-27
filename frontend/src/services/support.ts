export interface SupportInquiry { category: string; message: string }

export async function sendSupportInquiry(inquiry: SupportInquiry): Promise<void> {
  const response = await fetch('/api/support/inquiries', {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(inquiry),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { message?: string }
    throw new Error(error.message ?? '문의를 전송하지 못했습니다.')
  }
}

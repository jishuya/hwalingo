import nodemailer from 'nodemailer'
import { env } from '../config/env.js'

export const isMailConfigured = Boolean(
  env.smtpHost && env.smtpUser && env.smtpPassword && env.mailFrom,
)

const transporter = isMailConfigured
  ? nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
      auth: {
        user: env.smtpUser,
        pass: env.smtpPassword,
      },
    })
  : undefined

export async function sendPasswordResetCode(to: string, resetCode: string): Promise<void> {
  if (!transporter) throw new Error('SMTP is not configured')

  await transporter.sendMail({
    from: env.mailFrom,
    to,
    subject: '[Hwalingo] 비밀번호 재설정 인증코드',
    text: `Hwalingo 비밀번호 재설정 인증코드는 ${resetCode}입니다. 이 코드는 15분 동안 유효합니다. 본인이 요청하지 않았다면 이 메일을 무시해주세요.`,
    html: `
      <div style="max-width:520px;margin:0 auto;padding:32px;font-family:Arial,'Apple SD Gothic Neo',sans-serif;color:#18332a">
        <h1 style="margin:0 0 24px;color:#008c44;font-size:28px">Hwalingo</h1>
        <h2 style="margin:0 0 12px;font-size:22px">비밀번호 재설정</h2>
        <p style="margin:0 0 22px;line-height:1.7;color:#52635a">아래 인증코드를 비밀번호 재설정 화면에 입력해주세요.</p>
        <div style="padding:20px;border-radius:14px;background:#f1faf4;color:#008c44;text-align:center;font-size:30px;font-weight:700;letter-spacing:8px">${resetCode}</div>
        <p style="margin:22px 0 0;line-height:1.7;color:#718078;font-size:13px">인증코드는 15분 동안 유효합니다.<br>본인이 요청하지 않았다면 이 메일을 무시해주세요.</p>
      </div>
    `,
  })
}

export async function sendSupportInquiry(input: { userName: string; userEmail: string; category: string; message: string }): Promise<void> {
  if (!transporter) throw new Error('SMTP is not configured')
  await transporter.sendMail({
    from: env.mailFrom,
    to: 'jishuya3015@naver.com',
    replyTo: input.userEmail,
    subject: `[Hwalingo 문의] ${input.category} · ${input.userName}`,
    text: `문의 유형: ${input.category}\n사용자: ${input.userName}\n이메일: ${input.userEmail}\n\n문의 내용\n${input.message}`,
  })
}

import { Resend } from 'resend'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { logger } from './logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const getResend = (): Resend => {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not defined in environment variables')
  }
  return new Resend(process.env.RESEND_API_KEY)
}

export const sendWelcomeEmail = async (email: string, name: string) => {
  try {
    const resend = getResend()

    const templatePath = path.join(__dirname, '../templates/welcome.html')
    let html = fs.readFileSync(templatePath, 'utf8')

    html = html.replace('{{name}}', name)
    html = html.replace('{{email}}', email)

    const { data, error } = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'Planify <onboarding@resend.dev>',
      to: [email],
      subject: 'Bienvenue sur Planify !',
      html,
    })

    if (error) {
      logger.error({ err: error }, 'Erreur envoi email bienvenue')
      return { success: false, error }
    }

    logger.info({ data }, 'Email de bienvenue envoyé')
    return { success: true, data }
  } catch (error) {
    logger.error({ err: error }, 'Erreur sendWelcomeEmail')
    return { success: false, error: (error as Error).message }
  }
}

export const sendPasswordResetEmail = async (email: string, resetToken: string) => {
  try {
    const resend = getResend()

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`

    const templatePath = path.join(__dirname, '../templates/reset-password.html')
    let html = fs.readFileSync(templatePath, 'utf8')

    html = html.replace('{{resetUrl}}', resetUrl)

    const { data, error } = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'Planify <onboarding@resend.dev>',
      to: [email],
      subject: 'Réinitialisation de votre mot de passe',
      html,
    })

    if (error) {
      logger.error({ err: error }, 'Erreur envoi email reset')
      return { success: false, error }
    }

    logger.info({ data }, 'Email de reset envoyé')
    return { success: true, data }
  } catch (error) {
    logger.error({ err: error }, 'Erreur sendPasswordResetEmail')
    return { success: false, error: (error as Error).message }
  }
}

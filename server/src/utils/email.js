import { Resend } from 'resend'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Fonction helper pour obtenir l'instance Resend (lazy loading)
const getResend = () => {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not defined in environment variables')
  }
  return new Resend(process.env.RESEND_API_KEY)
}

/**
 * Envoyer un email de bienvenue
 */
export const sendWelcomeEmail = async (email, name) => {
  try {
    const resend = getResend()
    
    // Charger le template HTML
    const templatePath = path.join(__dirname, '../templates/welcome.html')
    let html = fs.readFileSync(templatePath, 'utf8')
    
    // Remplacer les variables
    html = html.replace('{{name}}', name)
    html = html.replace('{{email}}', email)
    
    const { data, error } = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'Planify <onboarding@resend.dev>',
      to: [email],
      subject: 'Bienvenue sur Planify !',
      html: html,
    })

    if (error) {
      console.error('Erreur envoi email bienvenue:', error)
      return { success: false, error }
    }

    console.log('Email de bienvenue envoyé:', data)
    return { success: true, data }
  } catch (error) {
    console.error('Erreur sendWelcomeEmail:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Envoyer un email de reset de mot de passe
 */
export const sendPasswordResetEmail = async (email, resetToken) => {
  try {
    const resend = getResend()
    
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`
    
    // Charger le template HTML
    const templatePath = path.join(__dirname, '../templates/reset-password.html')
    let html = fs.readFileSync(templatePath, 'utf8')
    
    // Remplacer les variables
    html = html.replace('{{resetUrl}}', resetUrl)
    
    const { data, error } = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'Planify <onboarding@resend.dev>',
      to: [email],
      subject: 'Réinitialisation de votre mot de passe',
      html: html,
    })

    if (error) {
      console.error('Erreur envoi email reset:', error)
      return { success: false, error }
    }

    console.log('Email de reset envoyé:', data)
    return { success: true, data }
  } catch (error) {
    console.error('Erreur sendPasswordResetEmail:', error)
    return { success: false, error: error.message }
  }
}
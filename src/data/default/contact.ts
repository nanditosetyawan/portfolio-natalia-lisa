export interface DefaultContactDetail {
  sectionId: 'contact-detail-section'
  messageSectionId: 'contact-message-section'
  welcomeGroupId: 'contact-detail-welcome-group'
  messageCardId: 'contact-detail-message-card'
  messageFieldsId: 'contact-detail-message-fields'
  mainPhotoId: 'contact-detail-photo-main'
  messagePhotoId: 'contact-detail-photo-message'
  title: { id: 'contact-detail-title'; text: string }
  subtitle: { id: 'contact-detail-subtitle'; text: string }
  description: { id: 'contact-detail-description'; text: string }
  socialLinks: {
    whatsapp: { id: 'contact-detail-wa'; label: string; href: string }
    linkedin: { id: 'contact-detail-linkedin'; label: string; href: string }
    cv: { id: 'contact-detail-cv'; label: string; href: string }
  }
  message: {
    title: { id: 'contact-detail-message-title'; text: string }
    submitButton: { id: 'contact-detail-submit-btn'; text: string }
  }
}

export interface DefaultContact {
  id: string
  line1: string
  line2: string
  cta: {
    id: string
    text: string
    href: string
  }
  personMediaUsageId: string
  detail: DefaultContactDetail
}

export const defaultContact: DefaultContact = {
  id: 'contact',
  line1: "LET'S WORK",
  line2: 'TOGETHER',
  cta: {
    id: 'contact-cta',
    text: 'CLICK HERE',
    href: ''
  },
  personMediaUsageId: 'contact-person-media',
  detail: {
    sectionId: 'contact-detail-section',
    messageSectionId: 'contact-message-section',
    welcomeGroupId: 'contact-detail-welcome-group',
    messageCardId: 'contact-detail-message-card',
    messageFieldsId: 'contact-detail-message-fields',
    mainPhotoId: 'contact-detail-photo-main',
    messagePhotoId: 'contact-detail-photo-message',
    title: { id: 'contact-detail-title', text: 'LISA NATALIA' },
    subtitle: { id: 'contact-detail-subtitle', text: 'NURSE' },
    description: { id: 'contact-detail-description', text: 'Hii, Thanks a lot for choose me, I am dedicated to providing high-quality healthcare services and professional support. Feel free to contact me or send a message below.' },
    socialLinks: {
      whatsapp: { id: 'contact-detail-wa', label: 'WhatsApp', href: '' },
      linkedin: { id: 'contact-detail-linkedin', label: 'LinkedIn', href: '' },
      cv: { id: 'contact-detail-cv', label: 'CV / Resume', href: '' }
    },
    message: {
      title: { id: 'contact-detail-message-title', text: 'TEXT ME' },
      submitButton: { id: 'contact-detail-submit-btn', text: 'Kirim Pesan' }
    }
  }
}

export default defaultContact

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
  personMediaUsageId: 'contact-person-media'
}

export default defaultContact

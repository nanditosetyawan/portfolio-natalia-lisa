export interface DefaultContact {
  line1: string
  line2: string
  cta: {
    text: string
    href: string
  }
  imageUrl: string
}

export const defaultContact: DefaultContact = {
  line1: "LET'S WORK",
  line2: 'TOGETHER',
  cta: {
    text: 'CLICK HERE',
    href: 'mailto:contact@example.com'
  },
  imageUrl: 'gambar1'
}

export default defaultContact
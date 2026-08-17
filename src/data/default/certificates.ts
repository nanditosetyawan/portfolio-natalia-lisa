export interface CertificateCard {
  id: string
  title: string
  date: string
  description: string
  thumbnailImage: string
  detailImages: string[]
}

export interface DefaultCertificates {
  title: string
  cards: CertificateCard[]
}

export const defaultCertificates: DefaultCertificates = {
  title: 'CERTIFIKAT',
  cards: [
    {
      id: 'cert-a',
      title: 'SERTIF A',
      date: '2025 - Now',
      description: 'Lorem ipsum dolor sit amet Lorem ipsum dolor sit ametLorem ipsum dolor sit ametLorem ipsum dolor sit ametLorem ipsum dolor sit ametLorem ipsum dolor sit ametLorem ipsum dolor sit ametLorem ipsum dolor sit amet',
      thumbnailImage: '',
      detailImages: ['', '', '']
    },
    {
      id: 'cert-b',
      title: 'SERTIF B',
      date: '2025 - Now',
      description: 'Lorem ipsum dolor sit amet Lorem ipsum dolor sit ametLorem ipsum dolor sit ametLorem ipsum dolor sit ametLorem ipsum dolor sit ametLorem ipsum dolor sit ametLorem ipsum dolor sit ametLorem ipsum dolor sit amet',
      thumbnailImage: '',
      detailImages: ['', '']
    }
  ]
}

export default defaultCertificates
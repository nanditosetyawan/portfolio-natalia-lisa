export interface CertificatePhotoPlaceholder {
  label: string
  hint: string
  color: string
  opacity: number
}

export interface CertificatePhotoArea {
  id: string
  source: string
  placeholder: CertificatePhotoPlaceholder
  image: {
    objectPosition: string
  }
}

export interface CertificateCard {
  id: string
  title: string
  date: string
  description: string
  thumbnail: CertificatePhotoArea
  detailImages: CertificatePhotoArea[]
  order?: number
  active?: boolean
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
      thumbnail: createCertificatePhotoArea('cert-a-thumbnail', 'Thumbnail sertif'),
      detailImages: [
        createCertificatePhotoArea('cert-a-detail-1', 'Foto Sertifikat 1'),
        createCertificatePhotoArea('cert-a-detail-2', 'Foto Sertifikat 2'),
        createCertificatePhotoArea('cert-a-detail-3', 'Foto Sertifikat 3')
      ]
    },
    {
      id: 'cert-b',
      title: 'SERTIF B',
      date: '2025 - Now',
      description: 'Lorem ipsum dolor sit amet Lorem ipsum dolor sit ametLorem ipsum dolor sit ametLorem ipsum dolor sit ametLorem ipsum dolor sit ametLorem ipsum dolor sit ametLorem ipsum dolor sit ametLorem ipsum dolor sit amet',
      thumbnail: createCertificatePhotoArea('cert-b-thumbnail', 'Thumbnail sertif'),
      detailImages: [
        createCertificatePhotoArea('cert-b-detail-1', 'Foto Sertifikat 1'),
        createCertificatePhotoArea('cert-b-detail-2', 'Foto Sertifikat 2')
      ]
    }
  ]
}

export function createCertificatePhotoArea(id: string, label: string): CertificatePhotoArea {
  return {
    id,
    source: '',
    placeholder: {
      label,
      hint: 'Pilih gambar di Admin',
      color: 'rgba(54, 45, 37, 0.45)',
      opacity: 1
    },
    image: {
      objectPosition: 'center center'
    }
  }
}

export function cloneCertificateCard(card: CertificateCard): CertificateCard {
  return {
    ...card,
    thumbnail: {
      ...card.thumbnail,
      placeholder: { ...card.thumbnail.placeholder },
      image: { ...card.thumbnail.image }
    },
    detailImages: card.detailImages.map((image) => ({
      ...image,
      placeholder: { ...image.placeholder },
      image: { ...image.image }
    }))
  }
}

export default defaultCertificates

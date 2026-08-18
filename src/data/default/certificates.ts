import type { PhotoAreaId } from './photoAreas'

export interface CertificatePhotoPlaceholder {
  label: string
  hint: string
  color: string
  opacity: number
}

export interface CertificatePhotoArea {
  id: PhotoAreaId
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

function createCertificatePhotoArea(id: PhotoAreaId, label: string): CertificatePhotoArea {
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

export default defaultCertificates

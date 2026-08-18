export type PhotoAreaId =
  | 'about-frame-back-2'
  | 'about-frame-main'
  | 'college-frame-back'
  | 'college-frame-front'
  | 'shs-frame-back'
  | 'shs-frame-front'
  | 'experience-frame-klinik-1'
  | 'experience-frame-klinik-2'
  | 'experience-frame-klinik-3'
  | 'experience-frame-klinik-4'
  | 'cert-a-thumbnail'
  | 'cert-a-detail-1'
  | 'cert-a-detail-2'
  | 'cert-a-detail-3'
  | 'cert-b-thumbnail'
  | 'cert-b-detail-1'
  | 'cert-b-detail-2'

export interface PhotoAreaDefinition {
  id: PhotoAreaId
  section: 'About' | 'College' | 'SHS' | 'Experience' | 'Certificate'
  label: string
  source: string
}

export const photoAreas: PhotoAreaDefinition[] = [
  { id: 'about-frame-back-2', section: 'About', label: 'Back 2', source: '' },
  { id: 'about-frame-main', section: 'About', label: 'Main', source: '' },
  { id: 'college-frame-back', section: 'College', label: 'Back', source: '' },
  { id: 'college-frame-front', section: 'College', label: 'Front', source: '' },
  { id: 'shs-frame-back', section: 'SHS', label: 'Back', source: '' },
  { id: 'shs-frame-front', section: 'SHS', label: 'Front', source: '' },
  { id: 'experience-frame-klinik-1', section: 'Experience', label: 'Klinik 1', source: '' },
  { id: 'experience-frame-klinik-2', section: 'Experience', label: 'Klinik 2', source: '' },
  { id: 'experience-frame-klinik-3', section: 'Experience', label: 'Klinik 3', source: '' },
  { id: 'experience-frame-klinik-4', section: 'Experience', label: 'Klinik 4', source: '' },
  { id: 'cert-a-thumbnail', section: 'Certificate', label: 'Sertif A thumbnail', source: '' },
  { id: 'cert-a-detail-1', section: 'Certificate', label: 'Sertif A detail 1', source: '' },
  { id: 'cert-a-detail-2', section: 'Certificate', label: 'Sertif A detail 2', source: '' },
  { id: 'cert-a-detail-3', section: 'Certificate', label: 'Sertif A detail 3', source: '' },
  { id: 'cert-b-thumbnail', section: 'Certificate', label: 'Sertif B thumbnail', source: '' },
  { id: 'cert-b-detail-1', section: 'Certificate', label: 'Sertif B detail 1', source: '' },
  { id: 'cert-b-detail-2', section: 'Certificate', label: 'Sertif B detail 2', source: '' }
]


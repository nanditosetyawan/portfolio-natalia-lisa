export interface SHSItem {
  id: string
  label: string
  school: string
  period: string
  description: string
}

export interface DefaultSHS {
  items: SHSItem[]
}

export const defaultSHS: DefaultSHS = {
  items: [
    {
      id: 'shs-1',
      label: 'SHS',
      school: 'SMAK SURABAYA',
      period: '2017 - 2020',
      description: 'Aktif dalam organisasi siswa dan kegiatan sosial. Mengembangkan dasar-dasar kepemimpinan dan minat pada bidang pelayanan masyarakat tingkat daerah.'
    }
  ]
}

export default defaultSHS
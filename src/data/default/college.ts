export interface CollegeItem {
  id: string
  order: number
  label: string
  school: string
  period: string
  description: string
  frameIds: { back: string; front: string }
}

export interface DefaultCollege {
  items: CollegeItem[]
}

export const defaultCollege: DefaultCollege = {
  items: [
    {
      id: 'college-1',
      order: 0,
      label: 'COLLEGE',
      school: 'STIKKES KEDIRI',
      period: '2020 - 2024',
      description: 'Menyelesaikan pendidikan tinggi dengan fokus pada keperawatan dan ilmu kesehatan masyarakat. Berpartisipasi aktif dalam kegiatan klinis dan penyuluhan kesehatan.',
      frameIds: { back: 'college-frame-back', front: 'college-frame-front' }
    }
  ]
}

export default defaultCollege

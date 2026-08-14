export interface ExperienceItem {
  id: string
  title: string
  date: string
  description: string
  layout: 'layout-text-left' | 'layout-img-left'
}

export interface DefaultExperience {
  title: string
  items: ExperienceItem[]
}

export const defaultExperience: DefaultExperience = {
  title: 'Experience',
  items: [
    {
      id: 'klinik-1',
      title: 'Praktik Klinik 1',
      date: 'Semester 1 - RSUD',
      description: 'Melaksanakan praktik klinik di RSUD dengan fokus pada asuhan keperawatan pasien, dokumentasi medis, dan kolaborasi tim kesehatan.',
      layout: 'layout-text-left'
    },
    {
      id: 'klinik-2',
      title: 'Praktik Klinik 2',
      date: 'Semester 2 - Puskesmas',
      description: 'Pengalaman praktik di Puskesmas dengan penekanan pada promotif, preventif, dan pelayanan komunitas kesehatan dasar.',
      layout: 'layout-img-left'
    },
    {
      id: 'klinik-3',
      title: 'Praktik Klinik 3',
      date: 'Semester 3 - Klinik Pratama',
      description: 'Praktik di Klinik Pratama dengan pembelajaran asuhan keperawatan masyarakat dan manajemen kasus kesehatan keluarga.',
      layout: 'layout-text-left'
    },
    {
      id: 'klinik-4',
      title: 'Praktik Klinik 4',
      date: 'Semester 4 - Rumah Sakit Jiwa',
      description: 'Pengalaman praktik di Rumah Sakit Jiwa dengan fokus pada asuhan keperawatan kesehatan jiwa dan interaksi terapeutik.',
      layout: 'layout-img-left'
    }
  ]
}

export default defaultExperience
import type { AboutParagraph } from '../../types/site'

export interface DefaultAbout {
  id: string
  title: string
  paragraphs: AboutParagraph[]
  cta: { id: string; text: string; targetSectionId: string }
}

export const defaultAbout: DefaultAbout = {
  id: 'about',
  title: 'Lisa Natalia',
  paragraphs: [
    { id: 'about-paragraph-intro', order: 0, body: 'Mahasiswa Keperawatan yang memiliki minat besar pada pelayanan kesehatan dan keselamatan pasien.' },
    { id: 'about-paragraph-experience', order: 1, body: 'Memiliki pengalaman praktik kerja lapangan di berbagai fasilitas kesehatan, serta aktif dalam organisasi dan kegiatan penyuluhan kesehatan masyarakat.' }
  ],
  cta: { id: 'about-cta-learn-more', text: 'LEARN MORE', targetSectionId: 'experience' }
}

export default defaultAbout

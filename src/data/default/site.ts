import gambar1 from './template_gambar/gambar1.webp'
import { defaultAbout } from './about'
import { defaultCollege } from './college'
import { defaultCertificates } from './certificates'
import { defaultContact } from './contact'
import { defaultEducation } from './education'
import { defaultExperience } from './experience'
import { defaultNavigation } from './navigation'
import { defaultPortfolioContent } from './portfolio'
import { defaultProfile } from './profile'
import { defaultSHS } from './shs'
import { defaultAboutConfig } from './visual/about'
import { defaultCertificateConfig } from './visual/certificate'
import { defaultCollegeConfig } from './visual/college'
import { defaultContactConfig } from './visual/contact'
import { defaultEducationConfig } from './visual/education'
import { defaultExperienceConfig } from './visual/experience'
import { defaultNavbarConfig } from './visual/navbar'
import { defaultPortfolioConfig } from './visual/portfolio'
import { defaultSHSConfig } from './visual/shs'
import type { MediaAsset, MediaUsage, PhotoAreaEntity } from '../../types/site'

const clone = <T>(value: T): T => structuredClone(value)

export function createDefaultSiteSnapshot() {
  const about = clone(defaultAbout)
  const college = clone(defaultCollege)
  const shs = clone(defaultSHS)
  const experience = clone(defaultExperience)

  const mediaAssets: MediaAsset[] = [{
    id: 'media-profile-primary',
    source: gambar1,
    alt: 'Lisa Natalia',
    mimeType: 'image/webp'
  }]
  const mediaUsages: MediaUsage[] = [
    { id: 'portfolio-profile-media', ownerId: defaultProfile.id, role: 'profile-image', mediaAssetId: 'media-profile-primary', objectPosition: '50% 50%' },
    { id: 'about-foreground-portrait', ownerId: about.id, role: 'foreground-portrait', mediaAssetId: 'media-profile-primary', objectPosition: '50% 50%' },
    { id: 'contact-person-media', ownerId: defaultContact.id, role: 'person-image', mediaAssetId: 'media-profile-primary', objectPosition: '50% 50%' }
  ]

  const photoAreas: PhotoAreaEntity[] = [
    { id: 'about-frame-back-2', ownerType: 'about', ownerId: about.id, role: 'frame-back', section: 'About', label: 'Back 2', source: '', objectPosition: defaultAboutConfig.frameBack2Image.objectPosition, persistence: 'runtime' },
    { id: 'about-frame-main', ownerType: 'about', ownerId: about.id, role: 'frame-main', section: 'About', label: 'Main', source: '', objectPosition: defaultAboutConfig.frameMainImage.objectPosition, persistence: 'runtime' },
    ...college.items.flatMap((item) => [
      { id: item.frameIds.back, ownerType: 'college-entry' as const, ownerId: item.id, role: 'frame-back', section: 'College', label: `${item.school} back`, source: '', objectPosition: defaultCollegeConfig.frameBackImage.objectPosition, persistence: 'runtime' as const },
      { id: item.frameIds.front, ownerType: 'college-entry' as const, ownerId: item.id, role: 'frame-front', section: 'College', label: `${item.school} front`, source: '', objectPosition: defaultCollegeConfig.frameFrontImage.objectPosition, persistence: 'runtime' as const }
    ]),
    ...shs.items.flatMap((item) => [
      { id: item.frameIds.back, ownerType: 'shs-entry' as const, ownerId: item.id, role: 'frame-back', section: 'SHS', label: `${item.school} back`, source: '', objectPosition: defaultSHSConfig.frameBackImage.objectPosition, persistence: 'runtime' as const },
      { id: item.frameIds.front, ownerType: 'shs-entry' as const, ownerId: item.id, role: 'frame-front', section: 'SHS', label: `${item.school} front`, source: '', objectPosition: defaultSHSConfig.frameFrontImage.objectPosition, persistence: 'runtime' as const }
    ]),
    ...experience.items.map((item) => ({ id: item.frameId, ownerType: 'experience-entry' as const, ownerId: item.id, role: 'frame', section: 'Experience', label: item.title, source: '', objectPosition: defaultExperienceConfig.imageFrames[item.frameId].image.objectPosition, persistence: 'runtime' as const }))
  ]

  return {
    content: {
      portfolio: clone(defaultPortfolioContent),
      profile: clone(defaultProfile),
      about,
      education: clone(defaultEducation),
      college,
      shs,
      experience,
      certificate: { id: 'certificate-section', title: defaultCertificates.title },
      contact: clone(defaultContact),
      navigation: clone(defaultNavigation)
    },
    visual: {
      portfolio: clone(defaultPortfolioConfig),
      about: clone(defaultAboutConfig),
      education: clone(defaultEducationConfig),
      college: clone(defaultCollegeConfig),
      shs: clone(defaultSHSConfig),
      experience: clone(defaultExperienceConfig),
      certificate: clone(defaultCertificateConfig),
      contact: clone(defaultContactConfig),
      navbar: clone(defaultNavbarConfig)
    },
    behavior: {
      certificate: { autoplay: true, slideshowIntervalMs: 3000 }
    },
    mediaAssets,
    mediaUsages,
    photoAreas
  }
}

export type SiteSnapshot = ReturnType<typeof createDefaultSiteSnapshot>

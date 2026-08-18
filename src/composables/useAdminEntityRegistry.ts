import { computed, type ComputedRef } from 'vue'
import { useCertificatesStore } from '../stores/certificates'
import { useSiteStore } from '../stores/site'
import type { AdminPropertyDefinition } from '../types/site'

export interface RuntimeAdminProperty extends AdminPropertyDefinition {
  read(): string | number | boolean
  write(value: string | number | boolean): void | Promise<unknown>
}

export interface RuntimeAdminEntity {
  id: string
  section: string
  label: string
  kind: 'content' | 'text' | 'frame' | 'media' | 'navigation'
  properties: RuntimeAdminProperty[]
}

function property(
  definition: Omit<AdminPropertyDefinition, 'path'>,
  owner: Record<string, unknown>,
  key: string
): RuntimeAdminProperty {
  return {
    ...definition,
    path: key,
    read: () => owner[key] as string | number | boolean,
    write: (value) => { owner[key] = value }
  }
}

function contentProperties(owner: Record<string, unknown>, keys: Array<[string, string, 'text' | 'textarea']>) {
  return keys.map(([key, label, control]) => property({ key, label, group: 'Content', control }, owner, key))
}

function certificateContentProperty(
  certificates: ReturnType<typeof useCertificatesStore>,
  cardId: string,
  key: 'title' | 'date' | 'description',
  label: string,
  control: 'text' | 'textarea'
): RuntimeAdminProperty {
  return {
    key, label, group: 'Content', control, path: key,
    read: () => certificates.editableCards.find((card) => card.id === cardId)?.[key] ?? '',
    write: (value) => certificates.updateCertificateContent(cardId, { [key]: String(value) })
  }
}

export function useAdminEntityRegistry(): ComputedRef<RuntimeAdminEntity[]> {
  const site = useSiteStore()
  const certificates = useCertificatesStore()

  return computed(() => {
    const current = site.current
    const entities: RuntimeAdminEntity[] = []
    const portfolio = current.content.portfolio as unknown as Record<string, unknown>
    entities.push({
      id: current.content.portfolio.id, section: 'Portfolio', label: 'Portfolio hero', kind: 'text',
      properties: [
        ...contentProperties(portfolio, [['title', 'Title', 'text']]),
        property({ key: 'fontFamily', label: 'Font family', group: 'Typography', control: 'text' }, current.visual.portfolio.title as unknown as Record<string, unknown>, 'fontFamily'),
        property({ key: 'fontSize', label: 'Font size', group: 'Typography', control: 'text' }, current.visual.portfolio.title as unknown as Record<string, unknown>, 'fontSize'),
        property({ key: 'color', label: 'Color', group: 'Typography', control: 'color' }, current.visual.portfolio.title as unknown as Record<string, unknown>, 'color')
      ]
    })
    entities.push({ id: current.content.profile.id, section: 'Portfolio', label: 'Profile', kind: 'content', properties: contentProperties(current.content.profile as unknown as Record<string, unknown>, [['name', 'Name / alt', 'text']]) })

    const about = current.content.about as unknown as Record<string, unknown>
    entities.push({
      id: current.content.about.id, section: 'About', label: 'About title', kind: 'text',
      properties: [
        ...contentProperties(about, [['title', 'Title', 'text']]),
        property({ key: 'fontFamily', label: 'Font family', group: 'Typography', control: 'text' }, current.visual.about.title as unknown as Record<string, unknown>, 'fontFamily'),
        property({ key: 'fontSize', label: 'Font size', group: 'Typography', control: 'text' }, current.visual.about.title as unknown as Record<string, unknown>, 'fontSize'),
        property({ key: 'color', label: 'Color', group: 'Typography', control: 'color' }, current.visual.about.title as unknown as Record<string, unknown>, 'color')
      ]
    })
    current.content.about.paragraphs.forEach((paragraph) => entities.push({
      id: paragraph.id, section: 'About', label: `Paragraph ${paragraph.order + 1}`, kind: 'content',
      properties: contentProperties(paragraph as unknown as Record<string, unknown>, [['body', 'Paragraph', 'textarea']])
    }))
    entities.push({ id: current.content.about.cta.id, section: 'About', label: 'About CTA', kind: 'navigation', properties: contentProperties(current.content.about.cta as unknown as Record<string, unknown>, [['text', 'Text', 'text'], ['targetSectionId', 'Target section ID', 'text']]) })

    const aboutFrame = current.visual.about.frameMain as unknown as Record<string, unknown>
    entities.push({
      id: 'about-frame-main', section: 'About', label: 'Main frame', kind: 'frame', properties: [
        property({ key: 'left', label: 'X / left', group: 'Layout', control: 'text' }, aboutFrame, 'left'),
        property({ key: 'top', label: 'Y / top', group: 'Layout', control: 'text' }, aboutFrame, 'top'),
        property({ key: 'width', label: 'Width', group: 'Layout', control: 'text' }, aboutFrame, 'width'),
        property({ key: 'height', label: 'Height', group: 'Layout', control: 'text' }, aboutFrame, 'height'),
        property({ key: 'transformRotate', label: 'Rotation', group: 'Layout', control: 'text' }, aboutFrame, 'transformRotate'),
        property({ key: 'backgroundColor', label: 'Background', group: 'Appearance', control: 'color' }, aboutFrame, 'backgroundColor'),
        property({ key: 'borderRadius', label: 'Radius', group: 'Appearance', control: 'text' }, aboutFrame, 'borderRadius'),
        property({ key: 'boxShadow', label: 'Shadow', group: 'Appearance', control: 'text' }, aboutFrame, 'boxShadow')
      ]
    })

    const education = current.content.education as unknown as Record<string, unknown>
    entities.push({ id: current.content.education.id, section: 'Education', label: 'Education title', kind: 'text', properties: contentProperties(education, [['title', 'Title', 'text']]) })
    current.content.college.items.forEach((item) => entities.push({ id: item.id, section: 'College', label: item.school, kind: 'content', properties: contentProperties(item as unknown as Record<string, unknown>, [['label', 'Label', 'text'], ['school', 'School', 'text'], ['period', 'Period', 'text'], ['description', 'Description', 'textarea']]) }))
    current.content.shs.items.forEach((item) => entities.push({ id: item.id, section: 'SHS', label: item.school, kind: 'content', properties: contentProperties(item as unknown as Record<string, unknown>, [['label', 'Label', 'text'], ['school', 'School', 'text'], ['period', 'Period', 'text'], ['description', 'Description', 'textarea']]) }))
    entities.push({ id: current.content.experience.id, section: 'Experience', label: 'Experience section title', kind: 'text', properties: contentProperties(current.content.experience as unknown as Record<string, unknown>, [['title', 'Title', 'text']]) })
    current.content.experience.items.forEach((item) => {
      entities.push({ id: item.id, section: 'Experience', label: item.title, kind: 'content', properties: contentProperties(item as unknown as Record<string, unknown>, [['title', 'Title', 'text'], ['date', 'Date', 'text'], ['description', 'Description', 'textarea']]) })
      const frame = current.visual.experience.imageFrames[item.frameId] as unknown as Record<string, unknown>
      entities.push({ id: item.frameId, section: 'Experience', label: `${item.title} frame`, kind: 'frame', properties: [
        property({ key: 'maxWidth', label: 'Width', group: 'Layout', control: 'text' }, frame, 'maxWidth'),
        property({ key: 'transformRotate', label: 'Rotation', group: 'Layout', control: 'text' }, frame, 'transformRotate'),
        property({ key: 'backgroundColor', label: 'Background', group: 'Appearance', control: 'color' }, frame, 'backgroundColor'),
        property({ key: 'borderRadius', label: 'Radius', group: 'Appearance', control: 'text' }, frame, 'borderRadius'),
        property({ key: 'boxShadow', label: 'Shadow', group: 'Appearance', control: 'text' }, frame, 'boxShadow')
      ] })
    })

    entities.push({ id: current.content.certificate.id, section: 'Certificate', label: 'Certificate section title', kind: 'text', properties: contentProperties(current.content.certificate as unknown as Record<string, unknown>, [['title', 'Title', 'text']]) })
    const contact = current.content.contact as unknown as Record<string, unknown>
    entities.push({ id: current.content.contact.id, section: 'Contact', label: 'Contact', kind: 'content', properties: contentProperties(contact, [['line1', 'Line 1', 'text'], ['line2', 'Line 2', 'text']]) })
    entities.push({ id: current.content.contact.cta.id, section: 'Contact', label: 'Contact CTA', kind: 'navigation', properties: contentProperties(current.content.contact.cta as unknown as Record<string, unknown>, [['text', 'Text', 'text'], ['href', 'Href', 'text']]) })
    entities.push({ id: 'navigation-brand', section: 'Navigation', label: 'Navigation brand', kind: 'text', properties: contentProperties(current.content.navigation as unknown as Record<string, unknown>, [['brand', 'Brand', 'text']]) })
    current.content.navigation.navItems.forEach((item) => entities.push({ id: item.id, section: 'Navigation', label: item.label, kind: 'navigation', properties: contentProperties(item as unknown as Record<string, unknown>, [['label', 'Label', 'text'], ['targetSectionId', 'Target section ID', 'text']]) }))

    certificates.editableCards.forEach((card) => entities.push({ id: card.id, section: 'Certificate', label: card.title, kind: 'content', properties: [
      certificateContentProperty(certificates, card.id, 'title', 'Title', 'text'),
      certificateContentProperty(certificates, card.id, 'date', 'Date', 'text'),
      certificateContentProperty(certificates, card.id, 'description', 'Description', 'textarea')
    ] }))

    entities.push({ id: 'certificate-behavior', section: 'Certificate', label: 'Slideshow behavior', kind: 'content', properties: [
      property({ key: 'autoplay', label: 'Autoplay', group: 'Behavior', control: 'checkbox' }, current.behavior.certificate as unknown as Record<string, unknown>, 'autoplay'),
      property({ key: 'slideshowIntervalMs', label: 'Interval (ms)', group: 'Behavior', control: 'number' }, current.behavior.certificate as unknown as Record<string, unknown>, 'slideshowIntervalMs')
    ] })
    return entities
  })
}

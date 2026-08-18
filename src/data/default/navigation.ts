export interface NavSection {
  id: string
  label: string
  menuKey: string
  darkBg: boolean
}

export interface NavItem {
  id: string
  key: string
  label: string
  targetSectionId: string
  offsetMode: 'fixed' | 'align-bottom'
  offset: number
}

export interface DefaultNavigation {
  brand: string
  sections: NavSection[]
  navItems: NavItem[]
}

export const defaultNavigation: DefaultNavigation = {
  brand: 'LISA NATALIA',
  sections: [
    { id: 'main',           label: 'Main',     menuKey: 'main',        darkBg: true  },
    { id: 'about',          label: 'About',    menuKey: 'about',       darkBg: false },
    { id: 'education',      label: 'About',    menuKey: 'about',       darkBg: false },
    { id: 'college-section',label: 'About',    menuKey: 'about',       darkBg: false },
    { id: 'shs-section',    label: 'About',    menuKey: 'about',       darkBg: false },
    { id: 'experience',     label: 'Activity', menuKey: 'activity',    darkBg: false },
    { id: 'certificate',    label: 'Activity', menuKey: 'activity',    darkBg: false },
    { id: 'contact',        label: 'Contact',  menuKey: 'contact',     darkBg: true  }
  ],
  navItems: [
    { id: 'navigation-main', key: 'main', label: 'Main', targetSectionId: 'main', offsetMode: 'fixed', offset: 0 },
    { id: 'navigation-about', key: 'about', label: 'About', targetSectionId: 'about', offsetMode: 'fixed', offset: 20 },
    { id: 'navigation-activity', key: 'activity', label: 'Activity', targetSectionId: 'experience', offsetMode: 'fixed', offset: 0 },
    { id: 'navigation-contact', key: 'contact', label: 'Contact', targetSectionId: 'contact', offsetMode: 'align-bottom', offset: 0 }
  ]
}

export default defaultNavigation

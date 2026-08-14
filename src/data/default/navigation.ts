export interface NavSection {
  id: string
  label: string
  menuKey: string
  darkBg: boolean
}

export interface NavItem {
  key: string
  label: string
  target: string
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
    { key: 'main',     label: 'Main',     target: 'main'     },
    { key: 'about',    label: 'About',    target: 'about'    },
    { key: 'activity', label: 'Activity', target: 'experience' },
    { key: 'contact',  label: 'Contact',  target: 'contact'  }
  ]
}

export default defaultNavigation
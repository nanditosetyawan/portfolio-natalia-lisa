/* Default Visual Configuration - Navbar */
export interface NavbarVisualConfig {
  brand: {
    fontFamily: string;
    fontSize: string;
    fontWeight: number;
    letterSpacing: string;
    lineHeight: number;
  };
  navLink: {
    fontFamily: string;
    fontSize: string;
    fontWeight: number;
    letterSpacing: string;
    lineHeight: number;
    scrolledFontSize: string;
    mobileFontSize: string;
  };
  colors: {
    darkBgText: string;
    lightBgText: string;
    scrolledText: string;
  };
}

export const defaultNavbarConfig: NavbarVisualConfig = {
  brand: {
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: '1.05rem',
    fontWeight: 600,
    letterSpacing: '0.06em',
    lineHeight: 1
  },
  navLink: {
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: '0.9rem',
    fontWeight: 500,
    letterSpacing: '0.04em',
    lineHeight: 1,
    scrolledFontSize: '0.875rem',
    mobileFontSize: '0.8rem'
  },
  colors: {
    darkBgText: '#FFF0BE',
    lightBgText: '#5A3E35',
    scrolledText: '#FFFFFF'
  }
}
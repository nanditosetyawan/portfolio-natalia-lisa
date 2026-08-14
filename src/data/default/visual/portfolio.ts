/* Default Visual Configuration - Portfolio Section */
export interface PortfolioVisualConfig {
  section: {
    minHeight: string;
    backgroundColor: string;
    backgroundImage: string;
  };
  title: {
    fontSize: string;
    fontWeight: number;
    lineHeight: number;
    letterSpacing: string;
    textTransform: string;
    color: string;
    fontFamily: string;
  };
  profileCard: {
    width: string;
    height: string;
    backgroundColor: string;
    borderRadius: string;
    border: string;
    boxShadow: string;
    transformRotate: string;
  };
  decorativeLayer: {
    opacity: number;
  };
  /* Card transform details are handled via JS, not CSS defaults */
}

export const defaultPortfolioConfig: PortfolioVisualConfig = {
  section: {
    minHeight: '100vh',
    backgroundColor: '#8D363A',
    backgroundImage: 'radial-gradient(ellipse at 50% 40%, rgba(180, 60, 60, 0.25) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(160, 50, 50, 0.15) 0%, transparent 50%)'
  },
  title: {
    fontSize: 'clamp(5.5rem, 13vw, 11rem)',
    fontWeight: 900,
    lineHeight: 0.85,
    letterSpacing: '-0.03em',
    textTransform: 'uppercase',
    color: '#FFF0BE',
    fontFamily: "'Inter', 'Arial Black', system-ui, sans-serif"
  },
  profileCard: {
    width: '360px',
    height: '300px',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: '1.25rem',
    border: '1.5px solid rgba(255, 255, 255, 0.25)',
    boxShadow: '0 24px 48px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
     transformRotate: 'rotate(4deg)'
  },
  decorativeLayer: {
    opacity: 0.9
  }
}
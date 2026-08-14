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
  decorStethoscope: {
    top: string;
    left: string;
    transformRotate: string;
    opacity: number;
  };
  decorEcg: {
    top: string;
    left: string;
    opacity: number;
  };
  decorPill: {
    top: string;
    right: string;
    transformRotate: string;
    color: string;
  };
  decorCircle: {
    opacity: number;
    color: string;
  };
  decorCircle1: {
    top: string;
    right: string;
    width: string;
    height: string;
  };
  decorCircle3: {
    bottom: string;
    left: string;
    width: string;
    height: string;
  };
  decorSparkle1: {
    top: string;
    left: string;
    width: string;
    height: string;
  };
  decorSparkle2: {
    top: string;
    right: string;
    width: string;
    height: string;
  };
  scrollArrow: {
    bottom: string;
    left: string;
    color: string;
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
  },
  decorStethoscope: {
    top: '20%',
    left: '20%',
    transformRotate: '0deg',
    opacity: 0.4
  },
  decorEcg: {
    top: '50%',
    left: '0%',
    opacity: 0.4
  },
  decorPill: {
    top: '15%',
    right: '15%',
    transformRotate: '15deg',
    color: 'rgba(255, 240, 190, 0.3)'
  },
  decorCircle: {
    opacity: 0.3,
    color: 'rgba(255, 240, 190, 0.3)'
  },
  decorCircle1: {
    top: '70%',
    right: '10%',
    width: '200px',
    height: '200px'
  },
  decorCircle3: {
    bottom: '20%',
    left: '50%',
    width: '150px',
    height: '150px'
  },
  decorSparkle1: {
    top: '30%',
    left: '30%',
    width: '24px',
    height: '24px'
  },
  decorSparkle2: {
    top: '60%',
    right: '30%',
    width: '20px',
    height: '20px'
  },
  scrollArrow: {
    bottom: '2rem',
    left: '50%',
    color: '#FFF0BE'
  }
}

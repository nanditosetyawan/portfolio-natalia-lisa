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
  profileImage: {
    width: string;
    height: string;
    maxWidth: string;
    maxHeight: string;
    borderRadius: string;
    tabletWidth: string;
    mobileWidth: string;
    tabletMaxHeight: string;
    mobileMaxHeight: string;
  };
  profileImageWrapper: {
    bottom: string;
    left: string;
    transform: string;
    zIndex: number;
    tabletTransform: string;
    mobileLeft: string;
    mobileTransform: string;
  };
  decorativeLayer: {
    opacity: number;
  };
  decorStethoscope: {
    top: string;
    left: string;
    transformRotate: string;
    opacity: number;
    color: string;
    width: string;
    height: string;
  };
  decorEcg: {
    top: string;
    left: string;
    opacity: number;
    color: string;
    width: string;
    height: string;
  };
  decorPill: {
    top: string;
    right: string;
    transformRotate: string;
    color: string;
    size: string;
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
    size: string;
  };
  decorSparkle2: {
    top: string;
    right: string;
    width: string;
    height: string;
    size: string;
  };
  scrollArrow: {
    bottom: string;
    left: string;
    color: string;
    size: string;
  };
  decorCross1: {
    size: string;
  };
  decorCross2: {
    size: string;
  };
  decorCross3: {
    size: string;
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
    fontSize: 'clamp(5.5rem, 13vw, 15rem)',
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
  profileImage: {
    width: 'clamp(320px, 36vw, 520px)',
    height: 'auto',
    maxWidth: 'none',
    maxHeight: '80vh',
    borderRadius: '1.25rem',
    tabletWidth: 'clamp(260px, 44vw, 360px)',
    mobileWidth: 'min(320px, 88vw)',
    tabletMaxHeight: '60vh',
    mobileMaxHeight: '50vh',
  },
  profileImageWrapper: {
    bottom: '0',
    left: '65%',
    transform: 'translateX(calc(-50% + 75.6px))',
    zIndex: 20,
    tabletTransform: 'translateX(-50%)',
    mobileLeft: '50%',
    mobileTransform: 'translateX(-50%)',
  },
  decorativeLayer: {
    opacity: 0.9
  },
  decorStethoscope: {
    top: '20%',
    left: '20%',
    transformRotate: '0deg',
    opacity: 0.4,
    color: 'rgba(255, 240, 192, 0.3)',
    width: '120',
    height: '120',
  },
  decorEcg: {
    top: '50%',
    left: '0%',
    opacity: 0.4,
    color: 'rgba(255, 240, 192, 0.35)',
    width: '100',
    height: '40',
  },
  decorPill: {
    top: '15%',
    right: '15%',
    transformRotate: '15deg',
    color: 'rgba(255, 240, 192, 0.3)',
    size: '36'
  },
  decorCircle: {
    opacity: 0.3,
    color: 'rgba(255, 240, 192, 0.3)'
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
    height: '24px',
    size: '14',
  },
  decorSparkle2: {
    top: '60%',
    right: '30%',
    width: '20px',
    height: '20px',
    size: '10',
  },
  scrollArrow: {
    bottom: '2rem',
    left: '50%',
    color: '#FFF0BE',
    size: '28'
  },
  decorCross1: {
    size: '28'
  },
  decorCross2: {
    size: '22'
  },
  decorCross3: {
    size: '18'
  }
}

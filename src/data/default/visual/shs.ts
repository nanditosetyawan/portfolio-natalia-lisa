/* Default Visual Configuration - SHS Section */
export interface SHSVisualConfig {
  section: {
    backgroundColor: string;
    minHeight: string;
    zIndex: number;
  };
  container: {
    maxWidth: string;
    padding: string;
    gap: string;
  };
  label: {
    color: string;
    fontSize: string;
    fontWeight: number;
    letterSpacing: string;
    fontFamily: string;
    marginBottom: string;
  };
  school: {
    color: string;
    fontSize: string;
    fontWeight: number;
    lineHeight: number;
    letterSpacing: string;
    fontFamily: string;
  };
  calendar: {
    color: string;
    fontSize: string;
    fontWeight: number;
    family: string;
    gap: string;
    marginBottom: string;
  };
  description: {
    color: string;
    fontSize: string;
    fontWeight: number;
    lineHeight: number;
    fontFamily: string;
  };
  /* Polaroid base appearance (shared by frames) */
  polaroid: {
    backgroundColor: string;
    borderRadius: string;
    boxShadow: string;
  };
  /* Polaroid frame positions (drag group) */
  frameBack: {
    width: string;
    height: string;
    top: string;
    left: string;
    transformRotate: string;
  };
  frameFront: {
    width: string;
    height: string;
    bottom: string;
    right: string;
    transformRotate: string;
  };
  /* Decorative "SHS" text */
  decoText: {
    top: string;
    left: string;
    transformRotate: string;
    color: string;
    fontSize: string;
    fontWeight: number;
    fontFamily: string;
  };
  /* Dot grids */
  dotGrid: {
    width: string;
    height: string;
    opacity: number;
  };
  dotGridTopLeft: {
    top: string;
    left: string;
  };
  dotGridBottomRight: {
    bottom: string;
    right: string;
  };
  /* Organic background shape */
  organicShape: {
    top: string;
    right: string;
    width: string;
    height: string;
    opacity: number;
  };
  /* Sparkles */
  sparkles: {
    top: string;
    right: string;
    color: string;
  };
  /* Tape elements */
  tapeTl: {
    top: string;
    left: string;
    transformRotate: string;
    width: string;
    height: string;
    backgroundColor: string;
  };
  tapeBr: {
    bottom: string;
    right: string;
    transformRotate: string;
    width: string;
    height: string;
    backgroundColor: string;
  };
  /* Curved arrow */
  arrow: {
    top: string;
    right: string;
    opacity: number;
  };
}

export const defaultSHSConfig: SHSVisualConfig = {
  section: {
    backgroundColor: '#FFF0BE',
    minHeight: '100vh',
    zIndex: 999
  },
  container: {
    maxWidth: '1400px',
    padding: '6rem 5rem',
    gap: '3rem'
  },
  label: {
    color: '#FF9A86',
    fontSize: '1.15rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
    fontFamily: "'Inter', system-ui, sans-serif",
    marginBottom: '0.25rem'
  },
  school: {
    color: '#8D363A',
    fontSize: 'clamp(2.5rem, 5vw, 4rem)',
    fontWeight: 700,
    lineHeight: 1.05,
    letterSpacing: '-0.01em',
    fontFamily: "Georgia, 'Times New Roman', serif"
  },
  calendar: {
    color: '#FF9A86',
    fontSize: '1.05rem',
    fontWeight: 600,
    family: "'Inter', system-ui, sans-serif",
    gap: '0.6rem',
    marginBottom: '1.25rem'
  },
  description: {
    color: '#3A3030',
    fontSize: '0.98rem',
    fontWeight: 400,
    lineHeight: 1.75,
    fontFamily: "'Inter', system-ui, sans-serif"
  },
  frameBack: {
    width: '310px',
    height: '350px',
    top: '5%',
    left: '5%',
    transformRotate: '-7deg'
  },
  frameFront: {
    width: '250px',
    height: '290px',
    bottom: '8%',
    right: '5%',
    transformRotate: '5deg'
  },
  polaroid: {
    backgroundColor: '#FFFFFF',
    borderRadius: '4px',
    boxShadow: '0 16px 32px rgba(61, 40, 34, 0.16)'
  },
  decoText: {
    top: '14%',
    left: '5%',
    transformRotate: '-6deg',
    color: '#FF9A86',
    fontSize: 'clamp(4rem, 5vw, 6rem)',
    fontWeight: 800,
    fontFamily: "'Inter', system-ui, sans-serif"
  },
  dotGrid: {
    width: '80px',
    height: '80px',
    opacity: 0.45
  },
  dotGridTopLeft: {
    top: '3rem',
    left: '3rem'
  },
  dotGridBottomRight: {
    bottom: '4rem',
    right: '3rem'
  },
  organicShape: {
    top: '-80px',
    right: '-60px',
    width: '300px',
    height: '300px',
    opacity: 0.12
  },
  sparkles: {
    top: '8%',
    right: '12%',
    color: '#FF9A86'
  },
  tapeTl: {
    top: '-12px',
    left: '10%',
    transformRotate: '-5deg',
    width: '80px',
    height: '24px',
    backgroundColor: 'rgba(196, 204, 141, 0.78)'
  },
  tapeBr: {
    bottom: '44px',
    right: '10%',
    transformRotate: '3deg',
    width: '80px',
    height: '24px',
    backgroundColor: 'rgba(196, 204, 141, 0.78)'
  },
  arrow: {
    top: '42%',
    right: '8%',
    opacity: 0.85
  }
}

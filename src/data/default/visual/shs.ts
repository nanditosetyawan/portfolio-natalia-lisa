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
  /* Polaroid frame positions (drag group) */
  frameBack: {
    id: string;
    width: string;
    height: string;
    top: string;
    left: string;
    transformRotate: string;
    zIndex: number;
    backgroundColor: string;
    border: string;
    borderRadius: string;
    boxShadow: string;
  };
  frameFront: {
    id: string;
    width: string;
    height: string;
    bottom: string;
    right: string;
    transformRotate: string;
    zIndex: number;
    backgroundColor: string;
    border: string;
    borderRadius: string;
    boxShadow: string;
  };
  frameBackImage: {
    source: string;
    objectFit: string;
    objectPosition: string;
  };
  frameFrontImage: {
    source: string;
    objectFit: string;
    objectPosition: string;
  };
  imagePlaceholder: {
    color: string;
    opacity: number;
    borderWidth: string;
    fontSize: string;
    labelOffset: string;
    arrowSize: number;
    zIndex: number;
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
  dotGrid3: {
    id: string;
    width: string;
    height: string;
    opacity: number;
    color: string;
    iconSize: number;
    strokeWidth: number;
    top: string;
    left: string;
    zIndex: number;
  };
  organicShape2: {
    id: string;
    top: string;
    left: string;
    width: string;
    height: string;
    opacity: number;
    color: string;
    iconSize: number;
    strokeWidth: number;
    zIndex: number;
  };
  sparkles2: {
    id: string;
    bottom: string;
    right: string;
    color: string;
    opacity: number;
    transformRotate: string;
    primarySize: number;
    secondarySize: number;
    zIndex: number;
  };
  arrow2: {
    id: string;
    top: string;
    left: string;
    width: number;
    height: number;
    transformRotate: string;
    opacity: number;
    zIndex: number;
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
    id: 'shs-frame-back',
    width: '310px',
    height: '350px',
    top: '5%',
    left: '5%',
    transformRotate: '-7deg',
    zIndex: 6,
    backgroundColor: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    boxShadow: '0 16px 32px rgba(61, 40, 34, 0.16)'
  },
  frameFront: {
    id: 'shs-frame-front',
    width: '250px',
    height: '290px',
    bottom: '8%',
    right: '5%',
    transformRotate: '5deg',
    zIndex: 7,
    backgroundColor: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    boxShadow: '0 16px 32px rgba(61, 40, 34, 0.16)'
  },
  frameBackImage: {
    source: '',
    objectFit: 'cover',
    objectPosition: 'center center'
  },
  frameFrontImage: {
    source: '',
    objectFit: 'cover',
    objectPosition: 'center center'
  },
  imagePlaceholder: {
    color: '#8D363A',
    opacity: 0.5,
    borderWidth: '2px',
    fontSize: '0.65rem',
    labelOffset: '0.45rem',
    arrowSize: 12,
    zIndex: 5
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
  },
  dotGrid3: {
    id: 'shs-dot-grid-003',
    width: '64px',
    height: '64px',
    opacity: 0.6,
    color: '#FF9A86',
    iconSize: 46,
    strokeWidth: 1.5,
    top: '78%',
    left: '45%',
    zIndex: 1
  },
  organicShape2: {
    id: 'shs-organic-002',
    top: '74%',
    left: '3%',
    width: '72px',
    height: '72px',
    opacity: 0.55,
    color: '#FF9A86',
    iconSize: 48,
    strokeWidth: 1.5,
    zIndex: 0
  },
  sparkles2: {
    id: 'shs-sparkles-002',
    bottom: '64%',
    right: '3%',
    color: '#FF9A86',
    opacity: 0.65,
    transformRotate: '18deg',
    primarySize: 46,
    secondarySize: 34,
    zIndex: 1
  },
  arrow2: {
    id: 'shs-arrow-002',
    top: '63%',
    left: '3%',
    width: 58,
    height: 58,
    transformRotate: '-118deg',
    opacity: 0.65,
    zIndex: 1
  }
}

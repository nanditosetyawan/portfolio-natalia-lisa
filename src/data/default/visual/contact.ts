/* Default Visual Configuration - Contact Section */
export interface ContactDecoration {
  opacity: number;
  strokeWidth: number;
  translateX: number;
  translateY: number;
  rotation: number;
}

export interface ContactVisualConfig {
  section: {
    backgroundColor: string;
    minHeight: string;
    padding: string;
    overflow: string;
    display: string;
    flexDirection: string;
    alignItems: string;
    justifyContent: string;
  };
  container: {
    width: string;
    maxWidth: string;
    margin: string;
    zIndex: number;
    display: string;
    flexDirection: string;
    alignItems: string;
    justifyContent: string;
  };
  textBlock: {
    flexBasis: string;
    padding: string;
    gap: string;
  };
  title: {
    fontFamily: string;
    fontSize: string;
    fontWeight: number;
    color: string;
    textTransform: string;
    letterSpacing: string;
    whiteSpace: string;
    display: string;
  };
  line1: {
    fontSize: string;
    letterSpacing: string;
    whiteSpace: string;
    display: string;
  };
  line2: {
    fontSize: string;
    letterSpacing: string;
    whiteSpace: string;
    display: string;
  };
  cta: {
    display: string;
    marginTop: string;
    alignSelf: string;
    cursor: string;
    transition: string;
    fontFamily: string;
    fontWeight: number;
    fontSize: string;
    letterSpacing: string;
    color: string;
    textTransform: string;
  };
  ctaHover: {
    opacity: number;
    letterSpacing: string;
  };
  personImage: {
    width: string;
    height: string;
    filter: string;
    zIndex: number;
  };
  personImagePlaceholder: {
    width: string;
    height: string;
    display: string;
    flexDirection: string;
    alignItems: string;
    justifyContent: string;
    gap: string;
    paddingBottom: string;
  };
  personSilhouette: {
    width: string;
    height: string;
    filter: string;
  };
  personLabel: {
    fontFamily: string;
    fontSize: string;
    fontWeight: number;
    letterSpacing: string;
    color: string;
    textTransform: string;
  };
  personSublabel: {
    fontFamily: string;
    fontSize: string;
    letterSpacing: string;
    color: string;
  };
  bgPattern: {
    width: string;
    height: string;
    color: string;
    opacity: number;
  };
  bgDecorations: {
    decorStethoscope: ContactDecoration;
    decorSyringeTop: ContactDecoration;
    decorMolecule: ContactDecoration;
    decorDna: ContactDecoration;
    decorHexagon: ContactDecoration;
    decorPill: ContactDecoration;
    decorEcg: ContactDecoration;
    decorSyringeBottom: ContactDecoration;
    decorCross: ContactDecoration;
    decorStethoscopeBottom: ContactDecoration;
  };
  ctaUnderline: {
    background: string;
    bottom: string;
    height: string;
  };
}

export const defaultContactConfig: ContactVisualConfig = {
  section: {
    backgroundColor: '#7B2329',
    minHeight: '120vh',
    padding: '0',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'flex-end',
  },
  container: {
    width: '100%',
    maxWidth: '100%',
    margin: '0',
    zIndex: 2,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  textBlock: {
    flexBasis: '62%',
    padding: '3rem 3rem 6rem 4.5rem',
    gap: '1rem',
  },
  title: {
    fontFamily: "'Impact', 'Arial Black', 'Franklin Gothic Heavy', sans-serif",
    fontSize: 'clamp(5rem, 9vw, 9.5rem)',
    fontWeight: 900,
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: '-0.02em',
    whiteSpace: 'nowrap',
    display: 'block',
  },
  line1: {
    fontSize: 'clamp(5rem, 9vw, 9.5rem)',
    letterSpacing: '-0.02em',
    whiteSpace: 'nowrap',
    display: 'block',
  },
  line2: {
    fontSize: 'clamp(3rem, 7vw, 7.5rem)',
    letterSpacing: '-0.02em',
    whiteSpace: 'nowrap',
    display: 'block',
  },
  cta: {
    display: 'inline-block',
    marginTop: '7.5rem',
    alignSelf: 'flex-start',
    fontFamily: "'Impact', 'Arial Black', 'Franklin Gothic Heavy', sans-serif",
    fontWeight: 900,
    fontSize: 'clamp(0.9rem, 1.2vw, 1.2rem)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#ffffff',
    cursor: 'pointer',
    transition: 'opacity 0.2s ease, letter-spacing 0.2s ease',
  },
  ctaHover: {
    opacity: 0.75,
    letterSpacing: '0.14em',
  },
  personImage: {
    width: 'clamp(180px, 22vw, 320px)',
    height: 'auto',
    filter: 'drop-shadow(0 0 40px rgba(255,255,255,0.08))',
    zIndex: 2,
  },
  personImagePlaceholder: {
    width: '50%',
    height: 'auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    paddingBottom: '2rem',
  },
  personSilhouette: {
    width: 'clamp(180px, 22vw, 320px)',
    height: 'auto',
    filter: 'drop-shadow(0 0 40px rgba(255,255,255,0.08))',
  },
  personLabel: {
    fontFamily: "'Impact', 'Arial Black', sans-serif",
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '0.15em',
    color: 'rgba(255, 255, 255, 0.3)',
    textTransform: 'uppercase',
  },
  personSublabel: {
    fontFamily: "'Arial', sans-serif",
    fontSize: '0.65rem',
    letterSpacing: '0.08em',
    color: 'rgba(255, 255, 255, 0.2)',
  },
  bgPattern: {
    width: '100%',
    height: '100%',
    color: '#ffffff',
    opacity: 0.12
  },
  bgDecorations: {
    decorStethoscope: {
      opacity: 0.12,
      strokeWidth: 1.8,
      translateX: 0,
      translateY: 0,
      rotation: 0
    },
    decorSyringeTop: {
      opacity: 0.10,
      strokeWidth: 1.8,
      translateX: 80,
      translateY: 100,
      rotation: -30
    },
    decorMolecule: {
      opacity: 0.09,
      strokeWidth: 1.5,
      translateX: 0,
      translateY: 0,
      rotation: 0
    },
    decorDna: {
      opacity: 0.10,
      strokeWidth: 1.6,
      translateX: 0,
      translateY: 0,
      rotation: 0
    },
    decorHexagon: {
      opacity: 0.09,
      strokeWidth: 1.5,
      translateX: 0,
      translateY: 0,
      rotation: 0
    },
    decorPill: {
      opacity: 0.10,
      strokeWidth: 1.8,
      translateX: 1150,
      translateY: 320,
      rotation: 45
    },
    decorEcg: {
      opacity: 0.09,
      strokeWidth: 1.6,
      translateX: 0,
      translateY: 0,
      rotation: 0
    },
    decorSyringeBottom: {
      opacity: 0.09,
      strokeWidth: 1.6,
      translateX: 1220,
      translateY: 480,
      rotation: 40
    },
    decorCross: {
      opacity: 0.09,
      strokeWidth: 2,
      translateX: 0,
      translateY: 0,
      rotation: 0
    },
    decorStethoscopeBottom: {
      opacity: 0.10,
      strokeWidth: 1.6,
      translateX: 0,
      translateY: 0,
      rotation: 0
    }
  },
  ctaUnderline: {
    background: '#ffffff',
    bottom: '-3px',
    height: '2px'
  }
}

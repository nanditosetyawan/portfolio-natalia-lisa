/* Default Visual Configuration - About Section */
export interface AboutVisualConfig {
  section: {
    backgroundColor: string;
    minHeight: string;
    padding: string;
  };
  container: {
    maxWidth: string;
    gap: string;
    minHeight: string;
  };
  content: {
    flexBasis: string;
    paddingTop: string;
  };
  title: {
    color: string;
    fontSize: string;
    fontWeight: number;
    lineHeight: number;
    fontFamily: string;
  };
  paragraph: {
    color: string;
    fontSize: string;
    fontWeight: number;
    lineHeight: number;
    maxWidth: string;
    fontFamily: string;
  };
  button: {
    backgroundColor: string;
    color: string;
    fontSize: string;
    fontWeight: number;
  };
  polaroid: {
    backgroundColor: string;
    borderRadius: string;
    boxShadow: string;
  };
  visual: {
    flexBasis: string;
    height: string;
  };
  /* Background decorative rings */
  bgRing1: {
    width: string;
    height: string;
    top: string;
    left: string;
  };
  bgRing2: {
    width: string;
    height: string;
    bottom: string;
    right: string;
    boxShadow: string;
  };
  /* Foreground decorative elements */
  decorDots: {
    top: string;
    right: string;
    width: string;
    height: string;
    opacity: number;
  };
  decorSparkle1: {
    top: string;
    left: string;
    color: string;
    opacity: number;
  };
  decorSparkle2: {
    bottom: string;
    right: string;
    color: string;
    opacity: number;
  };
  decorArrow: {
    top: string;
    right: string;
    opacity: number;
  };
  decorPlant: {
    left: string;
    bottom: string;
    opacity: number;
  };
  /* Polaroid frames */
  frameBack1: {
    width: string;
    height: string;
    top: string;
    left: string;
    transformRotate: string;
    zIndex: number;
  };
  frameBack2: {
    width: string;
    height: string;
    bottom: string;
    right: string;
    transformRotate: string;
    zIndex: number;
  };
  frameMain: {
    width: string;
    height: string;
    top: string;
    left: string;
    transformRotate: string;
    zIndex: number;
  };
  scrollArrow: {
    bottom: string;
    color: string;
    border: string;
    width: string;
    height: string;
  };
}

export const defaultAboutConfig: AboutVisualConfig = {
  section: {
    backgroundColor: '#FFF0BE',
    minHeight: '100vh',
    padding: '8rem 5rem 10rem'
  },
  container: {
    maxWidth: '1400px',
    gap: '3.5rem',
    minHeight: 'calc(100vh - 13.5rem)'
  },
  content: {
    flexBasis: '44%',
    paddingTop: '2rem'
  },
  title: {
    color: '#8D363A',
    fontSize: 'clamp(3.5rem, 6vw, 5.5rem)',
    fontWeight: 700,
    lineHeight: 1.02,
    fontFamily: "Georgia, 'Times New Roman', serif"
  },
  paragraph: {
    color: '#3A3030',
    fontSize: '1.02rem',
    fontWeight: 400,
    lineHeight: 1.75,
    maxWidth: '34rem',
    fontFamily: "'Inter', system-ui, sans-serif"
  },
  button: {
    backgroundColor: '#FF9A86',
    color: '#FFFFFF',
    fontSize: '0.9rem',
    fontWeight: 700
  },
  polaroid: {
    backgroundColor: '#FFFFFF',
    borderRadius: '4px',
    boxShadow: '0 16px 32px rgba(61, 40, 34, 0.16)'
  },
  visual: {
    flexBasis: '56%',
    height: '640px'
  },
  bgRing1: {
    width: '260px',
    height: '260px',
    top: '-70px',
    left: '-70px'
  },
  bgRing2: {
    width: '320px',
    height: '320px',
    bottom: '10%',
    right: '-110px',
    boxShadow: 'inset 0 0 0 1.5px rgba(220, 190, 170, 0.14)'
  },
  decorDots: {
    top: '3.25rem',
    right: '4.5rem',
    width: '84px',
    height: '84px',
    opacity: 0.5
  },
  decorSparkle1: {
    top: '22%',
    left: '5%',
    color: '#FF9A86',
    opacity: 1
  },
  decorSparkle2: {
    bottom: '24%',
    right: '10%',
    color: '#D62828',
    opacity: 1
  },
  decorArrow: {
    top: '34%',
    right: '6%',
    opacity: 0.85
  },
  decorPlant: {
    left: '1.5rem',
    bottom: '1.5rem',
    opacity: 0.9
  },
  frameBack1: {
    width: '210px',
    height: '252px',
    top: '2%',
    left: '4%',
    transformRotate: '-6deg',
    zIndex: 1
  },
  frameBack2: {
    width: '230px',
    height: '272px',
    bottom: '4%',
    right: '2%',
    transformRotate: '7deg',
    zIndex: 1
  },
  frameMain: {
    width: '300px',
    height: '380px',
    top: '15%',
    left: '42%',
    transformRotate: '1.5deg',
    zIndex: 3
  },
  scrollArrow: {
    bottom: '5.25rem',
    color: '#FF9A86',
    border: '2px solid #FF9A86',
    width: '46px',
    height: '46px'
  }
}

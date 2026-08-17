/* Default Visual Configuration - About Section */
import gambar1 from '../template_gambar/gambar1.webp'

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
  visual: {
    flexBasis: string;
    height: string;
  };
  /* Frame image slots */
  frameBack2Image: {
    source: string;
    objectFit: string;
    objectPosition: string;
  };
  frameMainImage: {
    source: string;
    objectFit: string;
    objectPosition: string;
  };
  foregroundPortrait: {
    source: string;
    width: string;
    top: string;
    right: string;
    zIndex: number;
  };
  /* Tape decoration */
  tape: {
    width: string;
    height: string;
    top: string;
    left: string;
    rotation: string;
    color: string;
    opacity: number;
    boxShadow: string;
    zIndex: number;
  };
  /* Image boundary placeholder (conditional, non-permanent) */
  imagePlaceholder: {
    color: string;
    opacity: number;
    borderWidth: string;
    fontSize: string;
    labelOffset: string;
    arrowSize: number;
    zIndex: number;
  };
  /* Background decorative rings */
  bgRing1: {
    width: string;
    height: string;
    top: string;
    left: string;
    opacity: number;
    strokeWidth: number;
    strokeColor: string;
  };
  bgRing2: {
    width: string;
    height: string;
    bottom: string;
    right: string;
    boxShadow: string;
    opacity: number;
    strokeWidth: number;
    strokeColor: string;
  };
  /* Foreground decorative elements */
  decorDots: {
    top: string;
    right: string;
    width: string;
    height: string;
    opacity: number;
    color: string;
  };
  decorSparkle1: {
    top: string;
    left: string;
    color: string;
    opacity: number;
    strokeWidth: number;
  };
  decorSparkle2: {
    bottom: string;
    right: string;
    color: string;
    opacity: number;
    strokeWidth: number;
  };
  decorArrow: {
    top: string;
    right: string;
    color: string;
    opacity: number;
    strokeWidth: number;
  };
  decorPlant: {
    left: string;
    bottom: string;
    color: string;
    opacity: number;
    strokeWidth: number;
  };
  /* Title swooshes */
  titleSwooshes: {
    color: string;
    strokeWidth: number;
  };
  /* Polaroid frames */
  frameBack2: {
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
  frameMain: {
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
  visual: {
    flexBasis: '56%',
    height: '640px'
  },
  frameBack2Image: {
    source: '',
    objectFit: 'cover',
    objectPosition: 'center center'
  },
  frameMainImage: {
    source: '',
    objectFit: 'cover',
    objectPosition: 'center center'
  },
  foregroundPortrait: {
    source: gambar1,
    width: '300px',
    top: '33%',
    right: '17%',
    zIndex: 5
  },
  tape: {
    width: '96px',
    height: '26px',
    top: '-13px',
    left: '50%',
    rotation: 'rotate(-4deg)',
    color: 'rgba(255, 214, 166, 0.75)',
    opacity: 0.75,
    boxShadow: 'inset 0 0 0 1px rgba(255, 214, 166, 0.6)',
    zIndex: 4
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
  bgRing1: {
    width: '260px',
    height: '260px',
    top: '-70px',
    left: '-70px',
    opacity: 0.18,
    strokeWidth: 1.5,
    strokeColor: '#DCCAAA'
  },
  bgRing2: {
    width: '320px',
    height: '320px',
    bottom: '10%',
    right: '-110px',
    boxShadow: 'inset 0 0 0 1.5px rgba(220, 190, 170, 0.14)',
    opacity: 0.14,
    strokeWidth: 1.5,
    strokeColor: '#DCCAAA'
  },
  decorDots: {
    top: '3.25rem',
    right: '4.5rem',
    width: '84px',
    height: '84px',
    opacity: 0.5,
    color: '#FF9A86'
  },
  decorSparkle1: {
    top: '22%',
    left: '5%',
    color: '#FF9A86',
    opacity: 1,
    strokeWidth: 1.5
  },
  decorSparkle2: {
    bottom: '24%',
    right: '10%',
    color: '#D62828',
    opacity: 1,
    strokeWidth: 1.5
  },
  decorArrow: {
    top: '34%',
    right: '6%',
    color: '#FF9A86',
    opacity: 0.85,
    strokeWidth: 2.5
  },
  decorPlant: {
    left: '1.5rem',
    bottom: '1.5rem',
    color: '#7A8B5C',
    opacity: 0.9,
    strokeWidth: 2.5
  },
  titleSwooshes: {
    color: '#FF9A86',
    strokeWidth: 3
  },
  frameBack2: {
    id: 'about-frame-back-2',
    width: '430px',
    height: '300px',
    bottom: '52.5%',
    right: '28%',
    transformRotate: '-5deg',
    zIndex: 1,
    backgroundColor: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    boxShadow: '0 16px 32px rgba(61, 40, 34, 0.16)'
  },
  frameMain: {
    id: 'about-frame-main',
    width: '130px',
    height: '130px',
    top: '27%',
    left: '61%',
    transformRotate: '1.5deg',
    zIndex: 3,
    backgroundColor: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    boxShadow: '0 16px 32px rgba(61, 40, 34, 0.16)'
  },
  scrollArrow: {
    bottom: '5.25rem',
    color: '#FF9A86',
    border: '2px solid #FF9A86',
    width: '46px',
    height: '46px'
  }
}

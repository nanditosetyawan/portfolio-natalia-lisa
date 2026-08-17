/* Default Visual Configuration - College Section */
export interface CollegeVisualConfig {
  section: {
    backgroundColor: string;
    minHeight: string;
  };
  container: {
    maxWidth: string;
    padding: string;
    gap: string;
  };
  content: {
    flexBasis: string;
  };
  label: {
    color: string;
    fontSize: string;
    fontWeight: number;
    fontFamily: string;
    marginBottom: string;
  };
  school: {
    color: string;
    fontSize: string;
    fontWeight: number;
    fontFamily: string;
  };
  calendar: {
    color: string;
    fontSize: string;
    fontWeight: number;
    fontFamily: string;
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
  visual: {
    flexBasis: string;
    height: string;
  };
  /* Decorative elements */
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
  circleDecor: {
    width: string;
    height: string;
    bottom: string;
    right: string;
    boxShadow: string;
  };
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
  tapeTl: {
    top: string;
    left: string;
    transformRotate: string;
    width: string;
    height: string;
  };
  tapeBr: {
    bottom: string;
    right: string;
    transformRotate: string;
    width: string;
    height: string;
  };
  decoText: {
    top: string;
    right: string;
    transformRotate: string;
    color: string;
    fontSize: string;
    fontWeight: number;
    fontFamily: string;
  };
  arrow: {
    right: string;
    top: string;
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
  dotGrid4: {
    id: string;
    width: string;
    height: string;
    opacity: number;
    color: string;
    iconSize: number;
    strokeWidth: number;
    top: string;
    right: string;
    zIndex: number;
  };
  circleDecor2: {
    id: string;
    width: string;
    height: string;
    top: string;
    left: string;
    opacity: number;
    boxShadow: string;
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
  arrow3: {
    id: string;
    top: string;
    right: string;
    width: number;
    height: number;
    transformRotate: string;
    opacity: number;
    zIndex: number;
  };
}

export const defaultCollegeConfig: CollegeVisualConfig = {
  section: {
    backgroundColor: '#FFF0BE',
    minHeight: '100vh'
  },
  container: {
    maxWidth: '1400px',
    padding: '6rem 5rem',
    gap: '3rem'
  },
  content: {
    flexBasis: '40%'
  },
  label: {
    color: '#FF9A86',
    fontSize: '1.15rem',
    fontWeight: 700,
    fontFamily: "'Inter', system-ui, sans-serif",
    marginBottom: '0.25rem'
  },
  school: {
    color: '#8D363A',
    fontSize: 'clamp(2.5rem, 5vw, 4rem)',
    fontWeight: 700,
    fontFamily: "Georgia, 'Times New Roman', serif"
  },
  calendar: {
    color: '#FF9A86',
    fontSize: '1.05rem',
    fontWeight: 600,
    fontFamily: "'Inter', system-ui, sans-serif",
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
  visual: {
    flexBasis: '55%',
    height: '580px'
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
  circleDecor: {
    width: '340px',
    height: '340px',
    bottom: '-120px',
    right: '-100px',
    boxShadow: 'inset 0 0 0 1.5px rgba(220, 190, 170, 0.14)'
  },
  frameBack: {
    id: 'college-frame-back',
    width: '480px',
    height: '360px',
    top: '7%',
    left: '11%',
    transformRotate: '-4deg',
    zIndex: 1,
    backgroundColor: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    boxShadow: '0 16px 32px rgba(61, 40, 34, 0.16)'
  },
  frameFront: {
    id: 'college-frame-front',
    width: '280px',
    height: '350px',
    bottom: '-7%',
    right: '1%',
    transformRotate: '5deg',
    zIndex: 3,
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
  tapeTl: {
    top: '-12px',
    left: '10%',
    transformRotate: '-5deg',
    width: '80px',
    height: '24px'
  },
  tapeBr: {
    bottom: '44px',
    right: '10%',
    transformRotate: '3deg',
    width: '80px',
    height: '24px'
  },
  decoText: {
    top: '-5%',
    right: '11%',
    transformRotate: '9deg',
    color: '#FF9A86',
    fontSize: '4.5rem',
    fontWeight: 800,
    fontFamily: "'Inter', system-ui, sans-serif"
  },
  arrow: {
    right: '18%',
    top: '46%',
    opacity: 0.8
  },
  dotGrid3: {
    id: 'college-dot-grid-003',
    width: '64px',
    height: '64px',
    opacity: 0.58,
    color: '#FF9A86',
    iconSize: 46,
    strokeWidth: 1.5,
    top: '24%',
    left: '2%',
    zIndex: 1
  },
  dotGrid4: {
    id: 'college-dot-grid-004',
    width: '62px',
    height: '62px',
    opacity: 0.55,
    color: '#FF9A86',
    iconSize: 44,
    strokeWidth: 1.5,
    top: '55%',
    right: '2%',
    zIndex: 1
  },
  circleDecor2: {
    id: 'college-circle-002',
    width: '70px',
    height: '70px',
    top: '43%',
    left: '2%',
    opacity: 0.9,
    boxShadow: 'inset 0 0 0 1.5px rgba(220, 190, 170, 0.14)',
    zIndex: 0
  },
  arrow2: {
    id: 'college-arrow-002',
    top: '32%',
    left: '2%',
    width: 58,
    height: 58,
    transformRotate: '-32deg',
    opacity: 0.68,
    zIndex: 1
  },
  arrow3: {
    id: 'college-arrow-003',
    top: '22%',
    right: '2%',
    width: 56,
    height: 56,
    transformRotate: '142deg',
    opacity: 0.66,
    zIndex: 1
  }
}

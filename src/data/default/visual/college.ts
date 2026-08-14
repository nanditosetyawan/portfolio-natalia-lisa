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
  polaroid: {
    backgroundColor: string;
    borderRadius: string;
    boxShadow: string;
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
    width: string;
    height: string;
    top: string;
    left: string;
    transformRotate: string;
    zIndex: number;
  };
  frameFront: {
    width: string;
    height: string;
    bottom: string;
    right: string;
    transformRotate: string;
    zIndex: number;
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
  polaroid: {
    backgroundColor: '#FFFFFF',
    borderRadius: '4px',
    boxShadow: '0 16px 32px rgba(61, 40, 34, 0.16)'
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
    width: '310px',
    height: '350px',
    top: '5%',
    left: '5%',
    transformRotate: '-7deg',
    zIndex: 1
  },
  frameFront: {
    width: '250px',
    height: '290px',
    bottom: '8%',
    right: '5%',
    transformRotate: '5deg',
    zIndex: 3
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
    top: '4%',
    right: '2%',
    transformRotate: '14deg',
    color: '#FF9A86',
    fontSize: '4.5rem',
    fontWeight: 800,
    fontFamily: "'Inter', system-ui, sans-serif"
  },
  arrow: {
    right: '18%',
    top: '46%',
    opacity: 0.8
  }
}

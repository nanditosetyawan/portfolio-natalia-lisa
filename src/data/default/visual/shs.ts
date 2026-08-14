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
  decoText: {
    top: '14%',
    left: '5%',
    transformRotate: '-6deg',
    color: '#FF9A86',
    fontSize: 'clamp(4rem, 5vw, 6rem)',
    fontWeight: 800,
    fontFamily: "'Inter', system-ui, sans-serif"
  }
}

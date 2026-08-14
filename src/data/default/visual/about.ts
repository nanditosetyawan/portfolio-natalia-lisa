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
}

export const defaultAboutConfig: AboutVisualConfig = {
  section: {
    backgroundColor: '#FFF0BE',
    minHeight: '100vh',
    padding: '6rem 5rem 7.5rem'
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
  }
}

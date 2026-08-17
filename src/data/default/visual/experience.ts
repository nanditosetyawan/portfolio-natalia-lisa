/* Default Visual Configuration - Experience Section */
export interface ExperienceVisualConfig {
  section: {
    backgroundColor: string;
    desktopHeight: string;
  };
  title: {
    color: string;
    fontSize: string;
    fontWeight: number;
    fontFamily: string;
    letterSpacing: string;
    top: string;
  };
  card: {
    paddingTop: string;
    paddingBottom: string;
  };
  itemTitle: {
    color: string;
    fontSize: string;
    fontWeight: number;
    lineHeight: number;
    fontFamily: string;
  };
  date: {
    color: string;
    fontSize: string;
    fontWeight: number;
    fontFamily: string;
  };
  description: {
    color: string;
    fontSize: string;
    lineHeight: number;
    fontFamily: string;
  };
  imageFrame: {
    maxWidth: string;
    borderRadius: string;
    boxShadow: string;
  };
  /* Background decorations */
  decorSyringe: {
    width: string;
    height: string;
    top: string;
    left: string;
    color: string;
    opacity: number;
  };
  decorHeartbeat: {
    width: string;
    height: string;
    bottom: string;
    right: string;
    color: string;
    opacity: number;
  };
  decorDots: {
    width: string;
    height: string;
    top: string;
    left: string;
    transformTranslateX: string;
    color: string;
    opacity: number;
  };
  decorCircle: {
    width: string;
    height: string;
    bottom: string;
    right: string;
    borderRadius: string;
    color: string;
    border: string;
    opacity: number;
  };
}

export const defaultExperienceConfig: ExperienceVisualConfig = {
  section: {
    backgroundColor: '#FFF0BE',
    desktopHeight: '400vh'
  },
  title: {
    color: '#8D363A',
    fontSize: 'clamp(3rem, 5vw, 4.5rem)',
    fontWeight: 700,
    fontFamily: "Georgia, 'Times New Roman', serif",
    letterSpacing: '-0.01em',
    top: 'clamp(5.5rem, 10vh, 7.5rem)'
  },
  card: {
    paddingTop: 'clamp(12rem, 20vh, 16rem)',
    paddingBottom: 'clamp(2rem, 4vh, 4rem)'
  },
  itemTitle: {
    color: '#8D363A',
    fontSize: 'clamp(1.75rem, 2.8vw, 2.4rem)',
    fontWeight: 700,
    lineHeight: 1.15,
    fontFamily: "Georgia, 'Times New Roman', serif"
  },
  date: {
    color: '#FF9A86',
    fontSize: '0.95rem',
    fontWeight: 500,
    fontFamily: "'Inter', system-ui, sans-serif"
  },
  description: {
    color: '#3A3030',
    fontSize: '1.05rem',
    lineHeight: 1.75,
    fontFamily: "'Inter', system-ui, sans-serif"
  },
  imageFrame: {
    maxWidth: '380px',
    borderRadius: '8px',
    boxShadow: '0 20px 40px rgba(61, 40, 34, 0.12), 0 8px 16px rgba(61, 40, 34, 0.08)'
  },
  decorSyringe: {
    width: '80px',
    height: '120px',
    top: '3rem',
    left: '3rem',
    color: '#8D363A',
    opacity: 0.7
  },
  decorHeartbeat: {
    width: '120px',
    height: '40px',
    bottom: '4rem',
    right: '4rem',
    color: '#D62828',
    opacity: 0.8
  },
  decorDots: {
    width: '100px',
    height: '100px',
    top: '8rem',
    left: '50%',
    transformTranslateX: '-50%',
    color: '#FF9A86',
    opacity: 0.35
  },
  decorCircle: {
    width: '300px',
    height: '300px',
    bottom: '-120px',
    right: '-120px',
    borderRadius: '50%',
    color: 'rgba(255, 214, 166, 0.2)',
    border: '2px solid rgba(255, 154, 134, 0.15)',
    opacity: 0.9
  }
}

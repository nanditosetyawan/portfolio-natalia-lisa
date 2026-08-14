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
  }
}

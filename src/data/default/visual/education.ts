/* Default Visual Configuration - Education Section */
export interface EducationVisualConfig {
  section: {
    backgroundColor: string;
    minHeight: string;
    paddingBottom: string;
  };
  container: {
    maxWidth: string;
    padding: string;
  };
  title: {
    color: string;
    fontSize: string;
    fontWeight: number;
    fontFamily: string;
    lineHeight: number;
  };
  icon: {
    width: number;
    height: number;
    color: string;
  };
  scrollIndicator: {
    color: string;
  };
}

export const defaultEducationConfig: EducationVisualConfig = {
  section: {
    backgroundColor: '#FFF0BE',
    minHeight: '100vh',
    paddingBottom: 'calc(clamp(4rem, 10vh, 8rem) + 200px)'
  },
  container: {
    maxWidth: '1200px',
    padding: '6rem 2rem 4rem'
  },
  title: {
    color: '#8D363A',
    fontSize: 'clamp(5.5rem, 14vw, 11rem)',
    fontWeight: 700,
    fontFamily: "Georgia, 'Times New Roman', serif",
    lineHeight: 1.02
  },
  icon: {
    width: 110,
    height: 92,
    color: '#8D363A'
  },
  scrollIndicator: {
    color: '#8D363A'
  }
}

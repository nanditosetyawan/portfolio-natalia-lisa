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
  }
}

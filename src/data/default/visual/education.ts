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
     margin: string;
   };
    title: {
      color: string;
      fontSize: string;
      fontWeight: number;
      fontFamily: string;
      lineHeight: number;
      letterSpacing: string;
      transformTranslateY: string;
    };
    icon: {
      width: number;
      height: number;
      color: string;
    };
    scrollIndicator: {
      color: string;
      gap: string;
      bottom: string;
      translateY: string;
    };
    /* Decorative elements */
    decorPill: {
      top: string;
      left: string;
      transformRotate: string;
      color: string;
    };
    decorSyringe: {
      top: string;
      right: string;
      transformRotate: string;
      color: string;
    };
    decorSparkle1: {
      top: string;
      left: string;
      color: string;
    };
    decorSparkle2: {
      top: string;
      right: string;
      color: string;
    };
    decorRing1: {
      width: string;
      height: string;
      top: string;
      right: string;
    };
    decorRing2: {
      width: string;
      height: string;
      bottom: string;
      left: string;
    };
    decorSparkle3: {
      id: string;
      top: string;
      left: string;
      color: string;
      size: number;
      strokeWidth: number;
      opacity: number;
      zIndex: number;
    };
    decorSparkle4: {
      id: string;
      top: string;
      left: string;
      color: string;
      size: number;
      strokeWidth: number;
      opacity: number;
      zIndex: number;
    };
    decorRing3: {
      id: string;
      width: string;
      height: string;
      top: string;
      left: string;
      opacity: number;
      zIndex: number;
    };
    decorRing4: {
      id: string;
      width: string;
      height: string;
      bottom: string;
      right: string;
      opacity: number;
      zIndex: number;
    };
}

export const defaultEducationConfig: EducationVisualConfig = {
  section: {
      backgroundColor: '#FFF0BE',
      minHeight: '100vh',
      paddingBottom: 'calc(clamp(4rem, 10vh, 8rem) + 4rem + 200px)'
    },
  container: {
      maxWidth: '1200px',
      padding: '14rem 2rem 4rem',
      margin: '0 auto'
    },
    title: {
      color: '#8D363A',
      fontSize: 'clamp(5.5rem, 14vw, 11rem)',
      fontWeight: 700,
      fontFamily: "Georgia, 'Times New Roman', serif",
      lineHeight: 1.02,
      letterSpacing: '-0.01em',
      transformTranslateY: '-3vh'
    },
    icon: {
      width: 110,
      height: 92,
      color: '#8D363A'
    },
  scrollIndicator: {
      color: '#8D363A',
      gap: '0.5rem',
      bottom: '9.24rem',
      translateY: '9.36rem'
    },
  decorPill: {
      top: '42%',
      left: '8%',
      transformRotate: '-28deg',
      color: 'rgba(255, 179, 153, 0.45)'
    },
    decorSyringe: {
      top: '38%',
      right: '7%',
      transformRotate: '18deg',
      color: 'rgba(255, 179, 153, 0.4)'
    },
    decorSparkle1: {
      top: '22%',
      left: '22%',
      color: 'rgba(141, 54, 58, 0.35)'
    },
    decorSparkle2: {
      top: '70%',
      right: '20%',
      color: 'rgba(141, 54, 58, 0.28)'
    },
    decorRing1: {
      width: '280px',
      height: '280px',
      top: '-80px',
      right: '-80px'
    },
    decorRing2: {
      width: '200px',
      height: '200px',
      bottom: '-50px',
      left: '-60px'
    },
    decorSparkle3: {
      id: 'education-sparkle-003',
      top: '12%',
      left: '8%',
      color: 'rgba(141, 54, 58, 0.32)',
      size: 46,
      strokeWidth: 1.5,
      opacity: 1,
      zIndex: 1
    },
    decorSparkle4: {
      id: 'education-sparkle-004',
      top: '68%',
      left: '12%',
      color: 'rgba(141, 54, 58, 0.3)',
      size: 42,
      strokeWidth: 1.5,
      opacity: 1,
      zIndex: 1
    },
    decorRing3: {
      id: 'education-ring-003',
      width: '70px',
      height: '70px',
      top: '12%',
      left: '28%',
      opacity: 0.9,
      zIndex: 0
    },
    decorRing4: {
      id: 'education-ring-004',
      width: '66px',
      height: '66px',
      bottom: '15%',
      right: '18%',
      opacity: 0.88,
      zIndex: 0
    }
}

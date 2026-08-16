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
   }
}

export const defaultEducationConfig: EducationVisualConfig = {
   section: {
     backgroundColor: '#FFF0BE',
     minHeight: '100vh',
     paddingBottom: 'calc(clamp(4rem, 10vh, 8rem) + 200px)'
   },
   container: {
     maxWidth: '1200px',
     padding: '6rem 2rem 4rem',
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
      gap: '0.85rem',
      bottom: '5rem'
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
   }
}

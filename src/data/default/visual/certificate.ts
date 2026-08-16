/* Default Visual Configuration - Certificate Section */
export interface CertificateVisualConfig {
  section: {
    backgroundColor: string;
    minHeight: string;
    padding: string;
    overflow: string;
    display: string;
    flexDirection: string;
    alignItems: string;
    justifyContent: string;
  };
  container: {
    width: string;
    maxWidth: string;
    margin: string;
    zIndex: number;
    display: string;
    flexDirection: string;
    alignItems: string;
    justifyContent: string;
  };
  titleWrapper: {
    marginBottom: string;
    textAlign: string;
    position: string;
    zIndex: number;
  };
  certificateTitle: {
    fontFamily: string;
    fontSize: string;
    fontWeight: number;
    color: string;
    textTransform: string;
    letterSpacing: string;
    margin: string;
    lineHeight: string;
    textShadow: string;
  };
  titleSparkles: {
    position: string;
    top: string;
    right: string;
    width: string;
    height: string;
    pointerEvents: string;
    color: string;
  };
  sparkle1: {
    position: string;
    top: string;
    left: string;
    width: string;
    height: string;
    animation: string;
    color: string;
  };
  sparkle2: {
    position: string;
    bottom: string;
    right: string;
    width: string;
    height: string;
    animation: string;
    animationDelay: string;
    color: string;
  };
  titleLineDivider: {
    display: string;
    alignItems: string;
    justifyContent: string;
    width: string;
    margin: string;
  };
  lineSegment: {
    flexGrow: number;
    height: string;
    backgroundColor: string;
    opacity: number;
  };
  lineGap: {
    width: string;
    flexShrink: number;
  };
  /* Background blobs */
  blobTopRight: {
    top: string;
    right: string;
    width: string;
    height: string;
    backgroundColor: string;
    opacity: number;
  };
  blobBottomRight: {
    bottom: string;
    right: string;
    width: string;
    height: string;
    backgroundColor: string;
    opacity: number;
  };
  blobBottomLeft: {
    bottom: string;
    left: string;
    width: string;
    height: string;
    backgroundColor: string;
    opacity: number;
  };
  /* Dot grids */
  dotGridTR: {
    top: string;
    right: string;
    width: string;
    height: string;
    color: string;
    opacity: number;
  };
  dotGridBL: {
    bottom: string;
    left: string;
    width: string;
    height: string;
    color: string;
    opacity: number;
  };
  /* Outline decorations */
  decorCert: {
    top: string;
    left: string;
    transformRotate: string;
    color: string;
    width: string;
    height: string;
  };
  decorMedal: {
    top: string;
    right: string;
    transformRotate: string;
    color: string;
    width: string;
    height: string;
  };
  /* Additional decorative elements */
  decorLeft: {
    top: string;
    left: string;
    transformRotate: string;
    color: string;
    width: string;
    height: string;
  };
  decorRightBottom: {
    bottom: string;
    right: string;
    transformRotate: string;
    color: string;
    width: string;
    height: string;
  };
  /* Organic wave shapes */
  waveShapeTop: {
    top: string;
    right: string;
    width: string;
    height: string;
    color: string;
  };
  waveShapeBottom: {
    bottom: string;
    left: string;
    width: string;
    height: string;
    color: string;
  };
  cardsStack: {
    display: string;
    flexDirection: string;
    gap: string;
    width: string;
    maxWidth: string;
    zIndex: number;
  };
  certificateCard: {
    display: string;
    flexDirection: string;
    alignItems: string;
    backgroundColor: string;
    borderRadius: string;
    padding: string;
    gap: string;
    boxShadow: string;
    transform: string;
    transition: string;
  };
  cardHeader: {
    display: string;
    flexDirection: string;
    alignItems: string;
    padding: string;
    gap: string;
    cursor: string;
    userSelect: string;
  };
  cardHeaderHover: {
    transform: string;
  };
  cardThumbnailWrapper: {
    flexShrink: number;
  };
  cardThumbnail: {
    width: string;
    height: string;
    aspectRatio: string;
    backgroundColor: string;
    borderRadius: string;
    display: string;
    flexDirection: string;
    alignItems: string;
    justifyContent: string;
    color: string;
    padding: string;
    boxShadow: string;
  };
  placeholderIcon: {
    marginBottom: string;
    opacity: number;
  };
  placeholderLabel: {
    fontFamily: string;
    fontSize: string;
    fontWeight: number;
    lineHeight: string;
  };
  placeholderSublabel: {
    fontFamily: string;
    fontSize: string;
    opacity: number;
    lineHeight: string;
  };
  cardInfo: {
    flexGrow: number;
    display: string;
    flexDirection: string;
    alignItems: string;
    textAlign: string;
  };
  infoMetadata: {
    display: string;
    alignItems: string;
    gap: string;
    color: string;
    marginBottom: string;
  };
  infoCalendarIcon: {
    flexShrink: number;
  };
  infoDate: {
    fontFamily: string;
    fontSize: string;
    fontWeight: number;
    letterSpacing: string;
  };
  infoTitle: {
    fontFamily: string;
    fontSize: string;
    fontWeight: number;
    color: string;
    margin: string;
    lineHeight: string;
  };
  infoDescription: {
    fontFamily: string;
    fontSize: string;
    fontWeight: number;
    color: string;
    margin: string;
    lineHeight: string;
    opacity: number;
  };
  cardAction: {
    flexShrink: number;
    display: string;
    alignItems: string;
    justifyContent: string;
  };
  actionBtn: {
    width: string;
    height: string;
    borderRadius: string;
    backgroundColor: string;
    border: string;
    color: string;
    display: string;
    alignItems: string;
    justifyContent: string;
    boxShadow: string;
    cursor: string;
    transition: string;
  };
  actionBtnHover: {
    backgroundColor: string;
    color: string;
    transform: string;
  };
  actionIcon: {
    transition: string;
  };
  actionIconRotated: {
    transform: string;
  };
  cardBody: {
    position: string;
    padding: string;
    borderTop: string;
  };
  slideContainer: {
    width: string;
    aspectRatio: string;
    overflow: string;
    borderRadius: string;
    boxShadow: string;
    backgroundColor: string;
  };
  slideTrack: {
    display: string;
    height: string;
    transition: string;
  };
  slideItem: {
    minWidth: string;
    height: string;
    flexShrink: number;
    display: string;
    alignItems: string;
    justifyContent: string;
    overflow: string;
  };
  certImage: {
    width: string;
    height: string;
    objectFit: string;
    borderRadius: string;
    display: string;
  };
  certPlaceholder: {
    width: string;
    height: string;
    background: string;
    borderRadius: string;
    border: string;
    display: string;
    flexDirection: string;
    alignItems: string;
    justifyContent: string;
    gap: string;
    color: string;
    fontFamily: string;
    fontSize: string;
    fontWeight: number;
  };
  certPlaceholderHint: {
    fontSize: string;
    opacity: number;
  };
  slideDots: {
    display: string;
    gap: string;
    alignItems: string;
    justifyContent: string;
    marginTop: string;
  };
  slideDot: {
    width: string;
    height: string;
    borderRadius: string;
    backgroundColor: string;
    border: string;
    cursor: string;
    padding: string;
    transition: string;
  };
  slideDotActive: {
    backgroundColor: string;
    transform: string;
  };
  slideDotHover: {
    backgroundColor: string;
  };
  certDownloadBtn: {
    position: string;
    bottom: string;
    right: string;
    width: string;
    height: string;
    borderRadius: string;
    backgroundColor: string;
    border: string;
    color: string;
    display: string;
    alignItems: string;
    justifyContent: string;
    boxShadow: string;
    cursor: string;
    transition: string;
    zIndex: number;
  };
  certDownloadBtnHover: {
    backgroundColor: string;
    color: string;
    transform: string;
    boxShadow: string;
  };
  bottomAction: {
    marginTop: string;
    zIndex: number;
  };
  refreshBtn: {
    width: string;
    height: string;
    borderRadius: string;
    backgroundColor: string;
    border: string;
    color: string;
    display: string;
    alignItems: string;
    justifyContent: string;
    boxShadow: string;
    cursor: string;
    transition: string;
  };
  refreshBtnHover: {
    transform: string;
    boxShadow: string;
  };
  refreshIcon: {
    transition: string;
  };
  expandEnterActive: {
    transition: string;
    overflow: string;
  };
  expandLeaveActive: {
    transition: string;
    overflow: string;
  };
  expandEnterFrom: {
    maxHeight: string;
    opacity: number;
  };
  expandLeaveTo: {
    maxHeight: string;
    opacity: number;
  };
  expandEnterTo: {
    maxHeight: string;
    opacity: number;
  };
  expandLeaveFrom: {
    maxHeight: string;
    opacity: number;
  };
}

export const defaultCertificateConfig: CertificateVisualConfig = {
  section: {
    backgroundColor: '#FDEBD6',
    minHeight: '100vh',
    padding: '6.5rem 1.5rem 7.5rem',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  container: {
    width: '100%',
    maxWidth: '1100px',
    margin: '0 auto',
    zIndex: 5,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrapper: {
    marginBottom: '3.5rem',
    textAlign: 'center',
    position: 'relative',
    zIndex: 5,
  },
  certificateTitle: {
    fontFamily: '\'Inter\', system-ui, sans-serif',
    fontSize: 'clamp(3rem, 7vw, 5.5rem)',
    fontWeight: 900,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    margin: '0 0 1rem',
    lineHeight: '1',
    textShadow: '4px 6px 12px rgba(54, 45, 37, 0.45), 1px 2px 3px rgba(54, 45, 37, 0.3)',
  },
  titleSparkles: {
    position: 'absolute',
    top: '-15px',
    right: '-25px',
    width: '35px',
    height: '35px',
    pointerEvents: 'none',
    color: '#F28C38',
  },
  sparkle1: {
    position: 'absolute',
    top: '0',
    left: '0',
    width: '24px',
    height: '24px',
    animation: 'shine 3s ease-in-out infinite',
    color: '#F28C38',
  },
  sparkle2: {
    position: 'absolute',
    bottom: '2px',
    right: '-5px',
    width: '14px',
    height: '14px',
    animation: 'shine 3s ease-in-out infinite',
    animationDelay: '1.5s',
    color: '#F28C38',
  },
  titleLineDivider: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '240px',
    margin: '0 auto',
  },
  lineSegment: {
    flexGrow: 1,
    height: '1.5px',
    backgroundColor: '#F28C38',
    opacity: 0.85,
  },
  lineGap: {
    width: '36px',
    flexShrink: 0,
  },
  blobTopRight: {
    top: '-8%',
    right: '-5%',
    width: '320px',
    height: '320px',
    backgroundColor: '#FAD6B4',
    opacity: 0.65,
  },
  blobBottomRight: {
    bottom: '8%',
    right: '-10%',
    width: '280px',
    height: '280px',
    backgroundColor: '#FAD6B4',
    opacity: 0.65,
  },
  blobBottomLeft: {
    bottom: '-6%',
    left: '-8%',
    width: '360px',
    height: '360px',
    backgroundColor: '#FAD6B4',
    opacity: 0.65,
  },
  dotGridTR: {
    top: '4%',
    right: '2%',
    width: '120px',
    height: '120px',
    color: '#F28C38',
    opacity: 0.3,
  },
  dotGridBL: {
    bottom: '12%',
    left: '2%',
    width: '120px',
    height: '120px',
    color: '#F28C38',
    opacity: 0.3,
  },
  decorCert: {
    top: '14%',
    left: '6%',
    transformRotate: '-12deg',
    color: '#F28C38',
    width: '160px',
    height: '160px',
  },
  decorMedal: {
    top: '12%',
    right: '6%',
    transformRotate: '15deg',
    color: '#F28C38',
    width: '160px',
    height: '160px',
  },
  decorLeft: {
    top: '42%',
    left: '3%',
    transformRotate: '20deg',
    color: '#F28C38',
    width: '160px',
    height: '160px',
  },
  decorRightBottom: {
    bottom: '12%',
    right: '8%',
    transformRotate: '-18deg',
    color: '#F28C38',
    width: '160px',
    height: '160px',
  },
  waveShapeTop: {
    top: '25%',
    right: '12%',
    width: '240px',
    height: '240px',
    color: '#F28C38',
  },
  waveShapeBottom: {
    bottom: '30%',
    left: '5%',
    width: '280px',
    height: '280px',
    color: '#F28C38',
  },
  cardsStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2.2rem',
    width: '100%',
    maxWidth: '820px',
    zIndex: 5,
  },
  certificateCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: '#F5EAE0',
    borderRadius: '20px',
    padding: '1.5rem 1.8rem',
    gap: '2rem',
    boxShadow:
      '0 15px 30px rgba(54, 45, 37, 0.08), 0 5px 12px rgba(54, 45, 37, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
    transform: 'none',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
  },
  cardHeader: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    padding: '1.5rem 1.8rem',
    gap: '2rem',
    cursor: 'pointer',
    userSelect: 'none',
  },
  cardHeaderHover: {
    transform: 'translateY(-4px)',
  },
  cardThumbnailWrapper: {
    flexShrink: 0,
  },
  cardThumbnail: {
    width: '110px',
    height: '110px',
    aspectRatio: '1 / 1',
    backgroundColor: '#B5ABA0',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#FFFFFF',
    padding: '0.5rem',
    boxShadow: 'inset 0 2px 6px rgba(0, 0, 0, 0.08)',
  },
  placeholderIcon: {
    marginBottom: '4px',
    opacity: 0.9,
  },
  placeholderLabel: {
    fontFamily: '\'Inter\', system-ui, sans-serif',
    fontSize: '0.85rem',
    fontWeight: 500,
    lineHeight: '1.2',
  },
  placeholderSublabel: {
    fontFamily: '\'Inter\', system-ui, sans-serif',
    fontSize: '0.75rem',
    opacity: 0.8,
    lineHeight: '1.1',
  },
  cardInfo: {
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    textAlign: 'left',
  },
  infoMetadata: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    color: '#F28C38',
    marginBottom: '0.4rem',
  },
  infoCalendarIcon: {
    flexShrink: 0,
  },
  infoDate: {
    fontFamily: '\'Inter\', system-ui, sans-serif',
    fontSize: '0.85rem',
    fontWeight: 700,
    letterSpacing: '0.02em',
  },
  infoTitle: {
    fontFamily: '\'Inter\', system-ui, sans-serif',
    fontSize: '1.35rem',
    fontWeight: 800,
    color: '#362D25',
    margin: '0 0 0.5rem',
    lineHeight: '1.2',
  },
  infoDescription: {
    fontFamily: '\'Inter\', system-ui, sans-serif',
    fontSize: '0.92rem',
    fontWeight: 400,
    color: '#362D25',
    margin: '0',
    lineHeight: '1.5',
    opacity: 0.85,
  },
  cardAction: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtn: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    backgroundColor: '#FFFFFF',
    border: 'none',
    color: '#F28C38',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 10px rgba(54, 45, 37, 0.08)',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease, transform 0.2s ease, color 0.2s ease',
  },
  actionBtnHover: {
    backgroundColor: '#F28C38',
    color: '#FFFFFF',
    transform: 'scale(1.05)',
  },
  actionIcon: {
    transition: 'transform 0.35s cubic-bezier(0.25, 1, 0.35, 1)',
  },
  actionIconRotated: {
    transform: 'rotate(180deg)',
  },
  cardBody: {
    position: 'relative',
    padding: '0 1.8rem 1.8rem',
    borderTop: '1px solid rgba(242, 140, 56, 0.12)',
  },
  slideContainer: {
    width: '100%',
    aspectRatio: '297 / 210',
    overflow: 'hidden',
    borderRadius: '14px',
    boxShadow: '0 8px 24px rgba(54, 45, 37, 0.10)',
    backgroundColor: '#EEE2D6',
  },
  slideTrack: {
    display: 'flex',
    height: '100%',
    transition: 'transform 0.45s cubic-bezier(0.25, 1, 0.35, 1)',
  },
  slideItem: {
    minWidth: '100%',
    height: '100%',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  certImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    borderRadius: '14px',
    display: 'block',
  },
  certPlaceholder: {
    width: '100%',
    height: '100%',
    background: 'linear-gradient(135deg, #EEE2D6 0%, #E4D4C4 100%)',
    borderRadius: '14px',
    border: '2px dashed rgba(242, 140, 56, 0.30)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    color: 'rgba(54, 45, 37, 0.45)',
    fontFamily: '\'Inter\', system-ui, sans-serif',
    fontSize: '0.95rem',
    fontWeight: 500,
  },
  certPlaceholderHint: {
    fontSize: '0.78rem',
    opacity: 0.6,
  },
  slideDots: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '1rem',
  },
  slideDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: 'rgba(242, 140, 56, 0.28)',
    border: 'none',
    cursor: 'pointer',
    padding: '0',
    transition: 'background 0.25s ease, transform 0.25s ease',
  },
  slideDotActive: {
    backgroundColor: '#F28C38',
    transform: 'scale(1.3)',
  },
  slideDotHover: {
    backgroundColor: 'rgba(242, 140, 56, 0.55)',
  },
  certDownloadBtn: {
    position: 'absolute',
    bottom: '1.4rem',
    right: '1.8rem',
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    backgroundColor: '#FFFFFF',
    border: 'none',
    color: '#F28C38',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(54, 45, 37, 0.12)',
    cursor: 'pointer',
    transition: 'background 0.2s ease, color 0.2s ease, transform 0.2s ease, boxShadow 0.2s ease',
    zIndex: 2,
  },
  certDownloadBtnHover: {
    backgroundColor: '#F28C38',
    color: '#FFFFFF',
    transform: 'scale(1.08)',
    boxShadow: '0 6px 16px rgba(242, 140, 56, 0.30)',
  },
  bottomAction: {
    marginTop: '3.5rem',
    zIndex: 5,
  },
  refreshBtn: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    backgroundColor: '#FFFFFF',
    border: 'none',
    color: '#F28C38',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 6px 16px rgba(54, 45, 37, 0.12)',
    cursor: 'pointer',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
  },
  refreshBtnHover: {
    transform: 'scale(1.08)',
    boxShadow: '0 8px 20px rgba(54, 45, 37, 0.16)',
  },
  refreshIcon: {
    transition: 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)',
  },
  expandEnterActive: {
    transition: 'max-height 0.45s cubic-bezier(0.25, 1, 0.35, 1), opacity 0.3s ease',
    overflow: 'hidden',
  },
  expandLeaveActive: {
    transition: 'max-height 0.35s cubic-bezier(0.4, 0, 1, 1), opacity 0.25s ease',
    overflow: 'hidden',
  },
  expandEnterFrom: {
    maxHeight: '0 !important',
    opacity: 0,
  },
  expandLeaveTo: {
    maxHeight: '600px',
    opacity: 1,
  },
  expandEnterTo: {
    maxHeight: '600px',
    opacity: 1,
  },
  expandLeaveFrom: {
    maxHeight: '0 !important',
    opacity: 0,
  },
}
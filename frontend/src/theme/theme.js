import { createTheme } from '@mui/material/styles';
import { brandTokens } from './tokens.js';

const { colors, radius, layout } = brandTokens;

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: colors.clinicalTeal,
      dark: colors.clinicalTealDark,
      light: colors.clinicalTealLight,
    },
    secondary: {
      main: colors.institutionalNavy,
    },
    info: {
      main: colors.informationBlue,
    },
    background: {
      default: colors.canvas,
      paper: colors.surface,
    },
    text: {
      primary: colors.text,
      secondary: colors.textMuted,
    },
    error: {
      main: colors.criticalRed,
    },
    warning: {
      main: colors.attentionAmber,
    },
    success: {
      main: colors.successGreen,
    },
  },
  shape: {
    borderRadius: radius.surface,
  },
  typography: {
    fontFamily: ['Roboto', 'Arial', 'sans-serif'].join(','),
    h1: { fontSize: '2rem', fontWeight: 800, lineHeight: 1.2 },
    h2: { fontSize: '1.5rem', fontWeight: 800, lineHeight: 1.25 },
    h3: { fontSize: '1.125rem', fontWeight: 800, lineHeight: 1.35 },
    subtitle1: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          scrollBehavior: 'smooth',
        },
        body: {
          minWidth: 320,
        },
        '.visually-hidden': {
          border: 0,
          clip: 'rect(0 0 0 0)',
          height: 1,
          margin: -1,
          overflow: 'hidden',
          padding: 0,
          position: 'absolute',
          whiteSpace: 'nowrap',
          width: 1,
        },
        '*:focus-visible': {
          outline: `3px solid ${colors.informationBlue}`,
          outlineOffset: 2,
        },
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': {
            animationDuration: '0.01ms !important',
            animationIterationCount: '1 !important',
            scrollBehavior: 'auto !important',
            transitionDuration: '0.01ms !important',
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: radius.control,
          minHeight: layout.touchTarget,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: colors.border,
          paddingBottom: 14,
          paddingTop: 14,
        },
        head: {
          backgroundColor: '#EAF0F5',
          color: colors.institutionalNavy,
          fontSize: '0.75rem',
          fontWeight: 800,
          textTransform: 'uppercase',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background-color 140ms ease',
          '&:last-child td': {
            borderBottom: 0,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        label: {
          fontWeight: 700,
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          minHeight: layout.touchTarget,
          minWidth: layout.touchTarget,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 48,
        },
      },
    },
  },
});

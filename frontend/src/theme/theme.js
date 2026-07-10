import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#0f766e',
      dark: '#115e59',
      light: '#5eead4',
    },
    secondary: {
      main: '#475569',
    },
    info: {
      main: '#2563eb',
    },
    background: {
      default: '#f4f7fb',
      paper: '#ffffff',
    },
    text: {
      primary: '#102033',
      secondary: '#607086',
    },
    error: {
      main: '#b42318',
    },
    warning: {
      main: '#b7791f',
    },
    success: {
      main: '#15803d',
    },
  },
  shape: {
    borderRadius: 8,
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
          borderRadius: 6,
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
          borderColor: '#e5eaf0',
          paddingBottom: 14,
          paddingTop: 14,
        },
        head: {
          backgroundColor: '#f8fafc',
          color: '#475569',
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
  },
});

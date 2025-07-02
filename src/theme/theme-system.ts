// src/theme/theme-system.ts
// Comprehensive theme system for entire application

export interface ComprehensiveTheme {
  name: string
  displayName: string
  monaco: string // Monaco theme ID
  ui: {
    primary: string // Main backgrounds
    secondary: string // Panel backgrounds
    tertiary: string // Hover states
    quaternary: string // Active states
    text: {
      primary: string
      secondary: string
      muted: string
      inverse: string
    }
    accent: {
      blue: string
      green: string
      purple: string
      orange: string
      red: string
      yellow: string
    }
    borders: {
      primary: string
      secondary: string
      focus: string
    }
    shadows: {
      small: string
      medium: string
      large: string
    }
  }
  syntax: {
    sceneHeading: string
    character: string
    dialogue: string
    parenthetical: string
    transition: string
    action: string
    emphasis: {
      italic: string
      bold: string
      underline: string
    }
    note: string
    lyric: string
    centered: string
    pageBreak: string
  }
}

// Enhanced Noctis Dark Theme
export const noctisThemes: Record<string, ComprehensiveTheme> = {
  'noctis-dark': {
    name: 'noctis-dark',
    displayName: 'Noctis Dark',
    monaco: 'noctis-dark',
    ui: {
      primary: '#1B2932',
      secondary: '#0d1e26',
      tertiary: '#2f3b42',
      quaternary: '#4a5568',
      text: {
        primary: '#a6accd',
        secondary: '#718096',
        muted: '#4a5568',
        inverse: '#ffffff'
      },
      accent: {
        blue: '#5ccfe6',
        green: '#bae67e',
        purple: '#c792ea',
        orange: '#ffd580',
        red: '#ff6b6b',
        yellow: '#ffeaa7'
      },
      borders: {
        primary: '#2f3b42',
        secondary: '#4a5568',
        focus: '#5ccfe6'
      },
      shadows: {
        small: 'rgba(0, 0, 0, 0.12)',
        medium: 'rgba(0, 0, 0, 0.15)',
        large: 'rgba(0, 0, 0, 0.25)'
      }
    },
    syntax: {
      sceneHeading: '#5ccfe6',
      character: '#bae67e',
      dialogue: '#ffeaa7',
      parenthetical: '#73d0ff',
      transition: '#ffd580',
      action: '#a6accd',
      emphasis: {
        italic: '#c792ea',
        bold: '#ffd580',
        underline: '#ff6b6b'
      },
      note: '#c792ea',
      lyric: '#5ccfe6',
      centered: '#73d0ff',
      pageBreak: '#ff6b6b'
    }
  },

  'noctis-viola': {
    name: 'noctis-viola',
    displayName: 'Noctis Viola',
    monaco: 'noctis-viola',
    ui: {
      primary: '#2A1B3D',
      secondary: '#1E0F2E',
      tertiary: '#3F2E52',
      quaternary: '#5A4570',
      text: {
        primary: '#D4C7E0',
        secondary: '#B8A5CC',
        muted: '#8B7A99',
        inverse: '#ffffff'
      },
      accent: {
        blue: '#8B9FFF',
        green: '#A6E3A1',
        purple: '#D9A3FF',
        orange: '#FFB84D',
        red: '#FF9999',
        yellow: '#FFF3A0'
      },
      borders: {
        primary: '#3F2E52',
        secondary: '#5A4570',
        focus: '#D9A3FF'
      },
      shadows: {
        small: 'rgba(0, 0, 0, 0.15)',
        medium: 'rgba(0, 0, 0, 0.20)',
        large: 'rgba(0, 0, 0, 0.30)'
      }
    },
    syntax: {
      sceneHeading: '#D9A3FF',
      character: '#A6E3A1',
      dialogue: '#FFF3A0',
      parenthetical: '#8B9FFF',
      transition: '#FFB84D',
      action: '#D4C7E0',
      emphasis: {
        italic: '#D9A3FF',
        bold: '#FFB84D',
        underline: '#FF9999'
      },
      note: '#D9A3FF',
      lyric: '#8B9FFF',
      centered: '#A6E3A1',
      pageBreak: '#FF9999'
    }
  },

  'noctis-azureus': {
    name: 'noctis-azureus',
    displayName: 'Noctis Azureus',
    monaco: 'noctis-azureus',
    ui: {
      primary: '#0F1922',
      secondary: '#0A1117',
      tertiary: '#1E2A35',
      quaternary: '#2D3E4D',
      text: {
        primary: '#B8D4E3',
        secondary: '#8BB4C7',
        muted: '#5A7A8A',
        inverse: '#ffffff'
      },
      accent: {
        blue: '#4FC3F7',
        green: '#81C784',
        purple: '#BA68C8',
        orange: '#FFB74D',
        red: '#E57373',
        yellow: '#FFF176'
      },
      borders: {
        primary: '#1E2A35',
        secondary: '#2D3E4D',
        focus: '#4FC3F7'
      },
      shadows: {
        small: 'rgba(0, 0, 0, 0.18)',
        medium: 'rgba(0, 0, 0, 0.22)',
        large: 'rgba(0, 0, 0, 0.35)'
      }
    },
    syntax: {
      sceneHeading: '#4FC3F7',
      character: '#81C784',
      dialogue: '#FFF176',
      parenthetical: '#64B5F6',
      transition: '#FFB74D',
      action: '#B8D4E3',
      emphasis: {
        italic: '#BA68C8',
        bold: '#FFB74D',
        underline: '#E57373'
      },
      note: '#BA68C8',
      lyric: '#4FC3F7',
      centered: '#64B5F6',
      pageBreak: '#E57373'
    }
  },

  'noctis-lux': {
    name: 'noctis-lux',
    displayName: 'Noctis Lux',
    monaco: 'noctis-lux',
    ui: {
      primary: '#000000',
      secondary: '#0A0A0A',
      tertiary: '#1A1A1A',
      quaternary: '#2A2A2A',
      text: {
        primary: '#FFFFFF',
        secondary: '#E0E0E0',
        muted: '#A0A0A0',
        inverse: '#000000'
      },
      accent: {
        blue: '#00D4FF',
        green: '#00FF88',
        purple: '#FF00FF',
        orange: '#FF8800',
        red: '#FF3333',
        yellow: '#FFFF00'
      },
      borders: {
        primary: '#333333',
        secondary: '#555555',
        focus: '#00D4FF'
      },
      shadows: {
        small: 'rgba(255, 255, 255, 0.1)',
        medium: 'rgba(255, 255, 255, 0.15)',
        large: 'rgba(255, 255, 255, 0.25)'
      }
    },
    syntax: {
      sceneHeading: '#00D4FF',
      character: '#00FF88',
      dialogue: '#FFFF00',
      parenthetical: '#88AAFF',
      transition: '#FF8800',
      action: '#FFFFFF',
      emphasis: {
        italic: '#FF00FF',
        bold: '#FF8800',
        underline: '#FF3333'
      },
      note: '#FF00FF',
      lyric: '#00D4FF',
      centered: '#88AAFF',
      pageBreak: '#FF3333'
    }
  },

  'noctis-sereno': {
    name: 'noctis-sereno',
    displayName: 'Noctis Sereno',
    monaco: 'noctis-sereno',
    ui: {
      primary: '#FEFEFE',
      secondary: '#F8F9FA',
      tertiary: '#F0F2F5',
      quaternary: '#E4E6EA',
      text: {
        primary: '#2E3440',
        secondary: '#5E81AC',
        muted: '#81A1C1',
        inverse: '#ffffff'
      },
      accent: {
        blue: '#5E81AC',
        green: '#A3BE8C',
        purple: '#B48EAD',
        orange: '#D08770',
        red: '#BF616A',
        yellow: '#EBCB8B'
      },
      borders: {
        primary: '#E5E7EB',
        secondary: '#D1D5DB',
        focus: '#5E81AC'
      },
      shadows: {
        small: 'rgba(0, 0, 0, 0.05)',
        medium: 'rgba(0, 0, 0, 0.08)',
        large: 'rgba(0, 0, 0, 0.12)'
      }
    },
    syntax: {
      sceneHeading: '#5E81AC',
      character: '#A3BE8C',
      dialogue: '#2E3440',
      parenthetical: '#D08770',
      transition: '#BF616A',
      action: '#4C566A',
      emphasis: {
        italic: '#B48EAD',
        bold: '#D08770',
        underline: '#BF616A'
      },
      note: '#B48EAD',
      lyric: '#5E81AC',
      centered: '#81A1C1',
      pageBreak: '#BF616A'
    }
  },

  'noctis-minimus': {
    name: 'noctis-minimus',
    displayName: 'Noctis Minimus',
    monaco: 'noctis-minimus',
    ui: {
      primary: '#FFFFFF',
      secondary: '#FAFAFA',
      tertiary: '#F5F5F5',
      quaternary: '#EEEEEE',
      text: {
        primary: '#2E2E2E',
        secondary: '#666666',
        muted: '#999999',
        inverse: '#ffffff'
      },
      accent: {
        blue: '#1976D2',
        green: '#388E3C',
        purple: '#7B1FA2',
        orange: '#F57C00',
        red: '#C2185B',
        yellow: '#F9A825'
      },
      borders: {
        primary: '#E0E0E0',
        secondary: '#BDBDBD',
        focus: '#1976D2'
      },
      shadows: {
        small: 'rgba(0, 0, 0, 0.08)',
        medium: 'rgba(0, 0, 0, 0.12)',
        large: 'rgba(0, 0, 0, 0.18)'
      }
    },
    syntax: {
      sceneHeading: '#1976D2',
      character: '#388E3C',
      dialogue: '#2E2E2E',
      parenthetical: '#F57C00',
      transition: '#C2185B',
      action: '#424242',
      emphasis: {
        italic: '#7B1FA2',
        bold: '#F57C00',
        underline: '#C2185B'
      },
      note: '#7B1FA2',
      lyric: '#1976D2',
      centered: '#1565C0',
      pageBreak: '#C2185B'
    }
  }
}

// Theme application functions
export const applyThemeToDocument = (theme: ComprehensiveTheme): void => {
  const root = document.documentElement

  // Apply UI colors
  root.style.setProperty('--bg-primary', theme.ui.primary)
  root.style.setProperty('--bg-secondary', theme.ui.secondary)
  root.style.setProperty('--bg-tertiary', theme.ui.tertiary)
  root.style.setProperty('--bg-quaternary', theme.ui.quaternary)

  // Text colors
  root.style.setProperty('--text-primary', theme.ui.text.primary)
  root.style.setProperty('--text-secondary', theme.ui.text.secondary)
  root.style.setProperty('--text-muted', theme.ui.text.muted)
  root.style.setProperty('--text-inverse', theme.ui.text.inverse)

  // Accent colors
  root.style.setProperty('--accent-blue', theme.ui.accent.blue)
  root.style.setProperty('--accent-green', theme.ui.accent.green)
  root.style.setProperty('--accent-purple', theme.ui.accent.purple)
  root.style.setProperty('--accent-orange', theme.ui.accent.orange)
  root.style.setProperty('--accent-red', theme.ui.accent.red)
  root.style.setProperty('--accent-yellow', theme.ui.accent.yellow)

  // Border colors
  root.style.setProperty('--border-primary', theme.ui.borders.primary)
  root.style.setProperty('--border-secondary', theme.ui.borders.secondary)
  root.style.setProperty('--border-focus', theme.ui.borders.focus)

  // Shadow colors
  root.style.setProperty('--shadow-sm', `0 1px 3px ${theme.ui.shadows.small}`)
  root.style.setProperty('--shadow-md', `0 4px 12px ${theme.ui.shadows.medium}`)
  root.style.setProperty('--shadow-lg', `0 8px 24px ${theme.ui.shadows.large}`)

  // Add transition for smooth theme changes
  root.style.setProperty('--transition-theme', '200ms ease-out')
}

export const getTheme = (themeName: string): ComprehensiveTheme => {
  return noctisThemes[themeName] || noctisThemes['noctis-dark']
}

export const getAllThemes = (): ComprehensiveTheme[] => {
  return Object.values(noctisThemes)
}

export const getAvailableThemeNames = (): string[] => {
  return Object.keys(noctisThemes)
}

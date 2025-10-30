# Product Requirements Document (PRD)
## Zephyr Cloud Design System & Visual Specifications

**Version:** 2.8.0  
**Last Updated:** October 30, 2025  
**Document Owner:** Design & Engineering Team

---

## Table of Contents

1. [Overview](#overview)
2. [Design Philosophy](#design-philosophy)
3. [Color System](#color-system)
4. [Typography](#typography)
5. [Spacing & Layout](#spacing--layout)
6. [Component Library](#component-library)
7. [Interactions & States](#interactions--states)
8. [Accessibility](#accessibility)
9. [Technical Implementation](#technical-implementation)
10. [Usage Guidelines](#usage-guidelines)

---

## Overview

### Product Description
Zephyr is a developer-first SaaS platform that seeks to enable data-driven decisions and AI throughout the entire SDLC (Software Development Lifecycle). This PRD documents the design system, color palette, typography, and component specifications used throughout the application.

### Technology Stack
- **UI Framework:** React 18.3.1
- **Styling:** Material-UI (MUI) 6.1.1 with Emotion
- **CSS Utilities:** Tailwind CSS 4.1.11
- **Type Safety:** TypeScript 5.8.4
- **State Management:** TanStack Query 5.56.2
- **Routing:** TanStack Router 1.114.17
- **Monorepo:** Nx 21.3.11

---

## Design Philosophy

### Core Principles
1. **Developer-First:** Clean, intuitive interfaces optimized for developer workflows
2. **Dark Mode Native:** Primary dark theme with high contrast for extended viewing
3. **Consistency:** Unified visual language across all modules and micro-frontends
4. **Accessibility:** WCAG 2.1 AA compliant with semantic HTML and ARIA labels
5. **Performance:** Optimized component rendering with React 18 features

### Visual Style
- **Modern & Clean:** Minimalist approach with purposeful use of color
- **Professional:** Enterprise-grade appearance suitable for B2B SaaS
- **Brand-Forward:** Strategic use of purple brand colors as primary accent

---

## Color System

### Brand Colors (Primary)

The brand identity uses purple as the primary accent color:

```typescript
Primary Brand Colors:
- brand-400: #9667ED (Primary brand color - Light purple)
- brand-500: #6B35D0 (Main brand color - Medium purple)
- brand-600: #5221AE (Dark brand color - Deep purple)
```

**Usage:**
- Primary CTAs (Call-to-Actions)
- Key interactive elements
- Brand moments and highlights
- Focus states and active selections

### Complete Color Palette

#### Purple Scale (Brand)
```
purple-25:  #F4EEFF  // Lightest tint
purple-50:  #CDC6DB
purple-100: #9D8DB6
purple-200: #7B689E
purple-300: #AE87F6
purple-400: #9667ED  // Primary brand
purple-500: #6B35D0  // Main brand
purple-600: #5221AE  // Dark brand
purple-700: #421597
purple-800: #381678
purple-900: #211041
purple-950: #130c20  // Darkest shade
```

#### Gray Scale (Foundation)
The gray scale forms the foundation of the UI, used extensively for backgrounds, text, and borders.

```
white:      #FFFFFF
gray-25:    #DDDDDD  // Lightest gray
gray-50:    #A9A9A9
gray-100:   #969696
gray-200:   #888888
gray-300:   #747474
gray-400:   #646464
gray-500:   #565656
gray-600:   #4A4A4A
gray-700:   #343434
gray-800:   #242424
gray-900:   #141414
gray-950:   #090807  // Darkest background
gray-900-20%: #14141433  // 20% opacity
gray-900-30%: #1414144D  // 30% opacity
```

**Gray Usage Map:**
- **Text Primary:** white (#FFFFFF)
- **Text Secondary:** gray-25, gray-100
- **Text Tertiary:** gray-200
- **Text Quaternary:** gray-400
- **Text Disabled:** gray-500
- **Borders Primary:** gray-100
- **Borders Secondary:** gray-700
- **Borders Tertiary:** gray-800
- **Background Primary:** gray-950
- **Background Secondary:** gray-900
- **Background Tertiary:** gray-800

#### Turquoise (Accent)
```
turquoise-25:  #86FFD3
turquoise-50:  #5CE7CA
turquoise-100: #4CBBA3
turquoise-200: #61E8B7
turquoise-300: #3ec594
turquoise-400: #09905F
turquoise-500: #27584D
turquoise-600: #1D3C35
turquoise-700: #162B27
turquoise-800: #101C19
turquoise-900: #0D1312
turquoise-950: #0B0E0E
```

**Usage:** Success states, positive metrics, growth indicators

#### Blue (Information)
```
blue-25:  #F5F8FF
blue-50:  #B5E4FF
blue-100: #80D1FF
blue-200: #00A3FF
blue-300: #3367B5
blue-400: #155CC7
blue-500: #1F41BD
blue-600: #0E3961
blue-700: #10215F
blue-800: #002140
blue-900: #060D26
blue-950: #001020
```

**Usage:** Informational messages, links, navigation highlights

#### Orange (Warning)
```
orange-25:  #FCD9BF
orange-50:  #FBCBA8
orange-100: #FBBF92
orange-200: #FAB27D
orange-300: #F9A96E
orange-400: #C9895A
orange-500: #996946
orange-600: #815A3C
orange-700: #6A4A32
orange-800: #523A28
orange-900: #3A2A1E
orange-950: #221A14
```

**Usage:** Warning states, caution indicators, pending actions

#### Pink/Carmine (Error)
```
pink-25:  #FFD4D4
pink-50:  #FFC4C4
pink-100: #FFB6B6
pink-200: #FFA8A8
pink-300: #FF9D9D
pink-400: #E57676
pink-500: #AE5B5B
pink-600: #934E4E
pink-700: #784040
pink-800: #5D3333
pink-900: #412525
pink-950: #261818
```

**Usage:** Error states, destructive actions, critical alerts

#### Semantic Colors

**Success:**
```
success-400: #47CD89  // Primary success color
success-500: #17B26A  // Darker success
```

**Warning:**
```
warning-400: #FDB022  // Primary warning color
warning-500: #F79009  // Darker warning
```

**Error:**
```
error-400: #F97066  // Primary error color
error-600: #F04438  // Darker error
```

### Color Application Guidelines

#### Text Colors (tx)
```typescript
tx: {
  primary: white                    // Main text, highest contrast
  secondary: {
    default: gray-25                // Secondary text
    alt: gray-100                   // Alternative secondary
    hover: gray-300                 // Hover state
  }
  tertiary: {
    default: gray-200               // Tertiary text
    hover: gray-300                 // Hover state
  }
  quarterary: gray-400              // Quaternary text
  white: white                      // Pure white text
  disabled: gray-500                // Disabled text
  placeholder: {
    default: gray-400               // Input placeholders
    subtle: gray-700                // Subtle placeholders
  }
  brand: {
    primary: purple-50              // Brand text highlight
    secondary: purple-300           // Secondary brand text
    tertiary: purple-400            // Tertiary brand text
  }
  error: {
    primary: error-400              // Error messages
  }
  warning: {
    primary: warning-400            // Warning messages
  }
  success: {
    primary: success-400            // Success messages
  }
}
```

#### Border Colors
```typescript
border: {
  primary: 1px solid gray-100       // Primary borders
  secondary: 1px solid gray-700     // Secondary borders
  tertiary: 1px solid gray-800      // Tertiary borders
  dashed: 1px dashed gray-400       // Dashed borders
  strong: 1px solid gray-25         // Strong emphasis borders
  none: 1px solid transparent       // No visible border
  disabled: {
    default: 1px solid gray-700     // Disabled borders
    subtle: 1px solid gray-800      // Subtle disabled
  }
  brand: {
    default: 1px solid brand-400    // Brand borders
    solid: 1px solid brand-600      // Solid brand borders
  }
  error: {
    default: 1px solid error-400    // Error borders
    solid: 1px solid error-600      // Solid error borders
  }
  warning: {
    default: 1px solid warning-400  // Warning borders
  }
}
```

#### Foreground Colors (fg)
```typescript
fg: {
  primary: white                    // Primary foreground (icons, etc)
  secondary: {
    default: gray-300               // Secondary foreground
    hover: gray-200                 // Hover state
  }
  tertiary: {
    default: gray-400               // Tertiary foreground
    hover: gray-300                 // Hover state
  }
  white: white                      // Pure white foreground
  disabled: {
    default: gray-500               // Disabled foreground
    subtle: gray-600                // Subtle disabled
  }
  brand: {
    default: brand-500              // Brand foreground
    alt: gray-300                   // Alternative brand
  }
  error: {
    primary: error-600              // Primary error foreground
    secondary: error-400            // Secondary error foreground
  }
  warning: {
    primary: warning-500            // Primary warning foreground
    secondary: warning-400          // Secondary warning foreground
  }
  success: {
    primary: success-500            // Primary success foreground
    secondary: success-400          // Secondary success foreground
  }
}
```

#### Background Colors (bg)
```typescript
bg: {
  primary: {
    default: gray-950               // Main app background
    alt: gray-900                   // Alternative primary
    hover: gray-800                 // Hover state
    solid: gray-900                 // Solid primary
  }
  secondary: {
    default: gray-900               // Secondary backgrounds
    alt: gray-950                   // Alternative secondary
    hover: gray-800                 // Hover state
    subtle: gray-900                // Subtle backgrounds
    solid: gray-600                 // Solid secondary
  }
  tertiary: gray-800                // Tertiary backgrounds
  quarterary: gray-700              // Quaternary backgrounds
  active: gray-800                  // Active state backgrounds
  disabled: {
    default: gray-800               // Disabled backgrounds
    subtle: gray-900                // Subtle disabled
  }
  overlay: gray-800                 // Modal/dialog overlays
  accentTransparent: gray-900 + 10% // Transparent accent
}
```

---

## Typography

### Font Family
**Primary Font:** Inter  
- Modern, clean, and highly legible sans-serif
- Optimized for UI and screen display
- Excellent readability at all sizes
- Source: Google Fonts / Inter typeface

### Font Sizes
```typescript
fontSize: {
  xxs:  '0.625rem'  // 10px - Micro text, labels
  xs:   '0.75rem'   // 12px - Small labels, captions
  sm:   '0.875rem'  // 14px - Body small, secondary text
  base: '1rem'      // 16px - Body text, primary content
  md:   '1.125rem'  // 18px - Emphasized body text
  lg:   '1.25rem'   // 20px - Small headings
  xl:   '1.5rem'    // 24px - Medium headings (H4)
  2xl:  '2rem'      // 32px - Large headings (H3)
  3xl:  '2.5rem'    // 40px - XL headings (H2)
  4xl:  '3.5rem'    // 56px - Hero headings (H1)
}
```

### Line Heights
```typescript
lineHeight: {
  xs:   '1rem'      // 16px - Tight spacing
  sm:   '1.25rem'   // 20px - Compact spacing
  base: '1.5rem'    // 24px - Default spacing
  md:   '1.75rem'   // 28px - Comfortable spacing
  lg:   '2rem'      // 32px - Relaxed spacing
  xl:   '2.5rem'    // 40px - Loose spacing
  2xl:  '3rem'      // 48px - Extra loose spacing
}
```

### Font Weights
```typescript
fontWeight: {
  thin:       100   // Rarely used
  extraLight: 200   // Rarely used
  light:      300   // Light emphasis
  normal:     400   // Body text, default
  medium:     500   // Subtle emphasis
  semiBold:   600   // Headings, emphasis (H1-H4)
  bold:       700   // Strong emphasis, labels
  extraBold:  800   // Extra emphasis
  black:      900   // Heavy emphasis
}
```

### Typography Presets

#### Headings
```typescript
h1: {
  fontWeight: 600      // semiBold
  // Use fontSize.4xl (56px) or 3xl (40px)
}
h2: {
  fontWeight: 600      // semiBold
  // Use fontSize.3xl (40px) or 2xl (32px)
}
h3: {
  fontWeight: 600      // semiBold
  lineHeight: 1.3      // 130%
  // Use fontSize.2xl (32px) or xl (24px)
}
h4: {
  fontWeight: 600      // semiBold
  lineHeight: 1.3      // 130%
  // Use fontSize.xl (24px) or lg (20px)
}
```

#### Body Text
```typescript
subtitle1: {
  fontWeight: 600      // semiBold
  // Use for emphasized body text
}
button: {
  fontWeight: 400      // normal (overridden in components to 700)
  textTransform: 'none'
}
```

#### Custom Text Styles
```typescript
labelBold: {
  fontFamily: 'Inter'
  fontSize: 16px
  fontWeight: 700
  lineHeight: 140%
}
labelBoldSmall: {
  fontFamily: 'Inter'
  fontSize: 14px
  fontWeight: 700
  lineHeight: 140%
}
regular2: {
  fontFamily: 'Inter'
  fontSize: 16px
  fontWeight: 400
  lineHeight: 140%
}
regular3: {
  fontFamily: 'Inter'
  fontSize: 14px
  fontWeight: 400
  lineHeight: 140%
}
```

---

## Spacing & Layout

### Border Radius
```typescript
borderRadius: {
  sm:   '0.125rem'  // 2px  - Tight corners
  md:   '0.375rem'  // 6px  - Small corners
  lg:   '0.5rem'    // 8px  - Default rounded (MUI default)
  xl:   '0.75rem'   // 12px - Medium rounded
  xxl:  '1rem'      // 16px - Large rounded
  3xl:  '1.5rem'    // 24px - XL rounded
  4xl:  '2rem'      // 32px - Button rounded
  full: '9999px'    // Pill shape (fully rounded)
}
```

**Usage Guidelines:**
- **Cards & Containers:** `lg` (8px)
- **Buttons (contained/outlined):** `full` (pill shape)
- **Inputs & Text Fields:** `lg` (8px)
- **Modals & Dialogs:** `xl` or `xxl` (12-16px)
- **Tooltips:** `lg` (8px)
- **Pills & Tags:** `full` (pill shape)

### Shadows & Elevation

#### Box Shadows
```typescript
boxShadow: {
  // Default focus ring for inputs
  default: '0px 1px 2px 0px rgba(16, 24, 40, 0.05), 
            0px 0px 0px 4px rgba(158, 119, 237, 0.30)'
  
  // Checked checkbox shadow
  checked: '0px 0px 0px 2px #3ec59440'
  
  // Primary button shadow
  contained: '0px 1px 2px 0px rgba(16, 24, 40, 0.05)'
  
  // Primary button focused shadow
  'contained-focused': '0px 0px 0px 4px rgba(255, 255, 255, 0.20)'
  
  // No shadow (transparent)
  transparent: '0px 1px 2px 0px rgba(16, 24, 40, 0), 
                0px 0px 0px 4px rgba(158, 119, 237, 0)'
}
```

### Spacing Scale
Material-UI uses an 8px base spacing unit:

```
spacing(1)   = 8px
spacing(1.5) = 12px
spacing(2)   = 16px
spacing(3)   = 24px
spacing(4)   = 32px
spacing(5)   = 40px
spacing(6)   = 48px
spacing(8)   = 64px
spacing(10)  = 80px
```

---

## Component Library

### Buttons

#### Variants

**1. Contained (Primary)**
- **Style:** White background with dark text
- **Border:** `border.primary` (gray-100)
- **Border Radius:** `full` (pill shape)
- **Color:** `bg.primary.default` (dark gray)
- **Shadow:** `boxShadow.contained`
- **Hover:** Background changes to `tx.secondary.default`, border to `border.secondary`
- **Focused:** `boxShadow.contained-focused`
- **Disabled:** No border, gray background

**2. Outlined (Secondary)**
- **Style:** Transparent background with border
- **Border:** `border.secondary` (gray-700)
- **Border Radius:** `full` (pill shape)
- **Color:** `tx.secondary.default` (gray-25)
- **Padding:** 8px 12px
- **Font:** 600 weight, 14px size
- **Hover:** White background with dark text
- **Focused:** `border.secondary`
- **Disabled:** No border

**3. Text (Tertiary)**
- **Style:** No background, no border
- **Color:** `tx.secondary.default` (gray-25)
- **Padding:** 8px 12px
- **Font:** 600 weight, 14px size
- **Hover:** Color changes to `tx.primary` (white)
- **Focused:** Color changes to `tx.primary`
- **Disabled:** Color is `tx.disabled`

**4. Warning Button (Contained)**
- **Background:** `brand.orange[700]`
- **Border:** `brand.orange[400]`
- **Color:** `tx.primary` (white)
- **Hover:** Background changes to `brand.orange[600]`
- **Focused:** `boxShadow.contained-focused`, border `brand.orange[400]`

**5. Error/Destructive Button (Contained)**
- **Background:** `brand.pink[700]`
- **Border:** `brand.pink[400]`
- **Color:** `tx.primary` (white)
- **Hover:** Background changes to `brand.pink[600]`
- **Focused:** `boxShadow.contained-focused`, border `brand.pink[400]`

#### Button Specifications
```typescript
Button: {
  height: '2.6rem' (41.6px)
  minWidth: theme.spacing(10) (80px)
  padding: '8px 12px'
  fontWeight: 700
  fontSize: 16px
  lineHeight: '150%'
  textTransform: 'none'
  whiteSpace: 'nowrap'
  width: 'fit-content'
  transition: 'background-color 0.3s ease, transform 0.2s ease'
  
  // Large size
  paddingTop: 10px
  paddingBottom: 10px
}
```

### Links

#### Link Variants
```typescript
LinkVariants: [
  'default',      // Standard link
  'secondary',    // Secondary emphasis
  'underline',    // With underline decoration
  'destructive',  // Red/error color
  'ghost',        // Minimal styling
  'brand',        // Brand color
  'link'          // Standard hyperlink
]
```

**Link Specifications:**
- **Default:** No text decoration
- **Color:** Inherits from context or specified
- **Component:** Uses TanStack Router Link with MUI styling
- **Hover:** Typically changes color or adds underline

### Text Fields & Inputs

#### Input States

**1. Default State**
- **Border:** `gray-700` (1px solid)
- **Box Shadow:** Transparent shadow (no visible shadow)
- **Background:** Inherits from theme

**2. Hover State**
- **Border:** `gray-300` (variable: `--TextField-brandBorderHoverColor`)

**3. Focused State**
- **Border:** `gray-25` (1px solid) (variable: `--TextField-brandBorderFocusedColor`)
- **Box Shadow:** `0px 1px 2px 0px rgba(16, 24, 40, 0.05), 0px 0px 0px 4px rgba(158, 119, 237, 0.30)`
- **Label Color:** `gray-25`

**4. Disabled State**
- Inherits MUI disabled styles

**Input Variants:**
- **Outlined:** Most common, with outlined border
- **Filled:** Filled background style
- **Standard:** Underline style

### Tooltips
```typescript
Tooltip: {
  borderRadius: 8px
  backgroundColor: gray-600
  fontFamily: 'Inter'
  fontStyle: 'normal'
  fontWeight: 400
  fontSize: 14px
  lineHeight: '140%'
  arrow: {
    color: gray-600
  }
}
```

### Cards

**Card Components:**
- `Card` - Main container
- `CardHeader` - Title and actions area
- `CardBody` - Content area
- `CardFooter` - Actions and metadata
- `BackgroundCard` - Card with custom background styling

**Card Styling:**
- Background: Typically `bg.secondary.default` (gray-900) or `bg.tertiary` (gray-800)
- Border: Optional, typically `border.secondary` or `border.tertiary`
- Border Radius: `lg` (8px) or `xl` (12px)
- Padding: Varies by content, typically 16px - 24px

### Icons

The application includes a comprehensive icon library with custom SVG icons:

**Icon Categories:**
- **UI Actions:** Add, Edit, Delete, Close, Copy, Search, Refresh, Download
- **Navigation:** Arrows (Up, Down, Left, Right, Back), ChevronDown, GoBack
- **Status:** Success, Error, Warning, Info, Checkmark
- **Social:** Discord, various payment icons (Visa, Mastercard, Amex, Discover)
- **Cloud Providers:** AWS, Azure, GoogleCloud, Akamai, Cloudflare, Fastly, Netlify
- **Dev Tools:** React, NextJs, Angular, Webpack, Rspack, EsBuild, Nx
- **Product:** Zephyr logos (mobile, full), Projects, Deployment Integrations, Settings
- **People:** Person, People, Group, UsersAlt
- **Objects:** Building, Calendar, Bell, CreditCard, Message, Mail, Token

**Icon Usage:**
- All icons are React components
- Typically accept color and size props
- Default fill/stroke colors match theme
- Should maintain accessibility with proper aria-labels

### Tables

**Table Implementations:**
1. **AgGrid** - Full-featured data grid with sorting, filtering, pagination
2. **TanStack Table** - Lightweight table with React Table v8
3. **TanStack Table with Virtualizer** - Performance-optimized for large datasets
4. **VirtualTable** - Custom virtualized table implementation

**Table Styling:**
- Header background: `bg.secondary.default` or darker
- Row background: Alternating or `bg.primary.default`
- Border: `border.secondary` or `border.tertiary`
- Hover: `bg.primary.hover` (gray-800)
- Text: `tx.primary` for data, `tx.secondary` for labels

### Modals & Dialogs

**Modal Components:**
- `ConfirmModal` - Simple confirmation dialog
- `ConfirmModalV2` - Enhanced confirmation dialog
- `ConfirmationModal` - Another variant
- `AddOrganizationModal` - Organization creation
- `AddOrganizationMemberModal` - Member invitation
- `AlphaAcceptModal` - Alpha program acceptance
- `GlobalInfoMessageModal` - System-wide messages

**Modal Styling:**
- Backdrop: Semi-transparent overlay (`bg.overlay`)
- Container background: `bg.primary.default` (gray-950) or `bg.secondary.default`
- Border radius: `xl` (12px) or `xxl` (16px)
- Box shadow: Elevated shadow for depth
- Padding: 24px - 32px

### Navigation

**Navigation Components:**
- `LeftSideNavigation` - Main left sidebar
- `LeftSideNavigationV2` - Enhanced version
- `LeftSideNavigationMenu` - Menu within sidebar
- `LeftSideNavigationMenuV2` - Enhanced menu
- `ProfileMenu` - User profile dropdown
- `CustomBreadcrumbs` - Breadcrumb navigation

**Navigation Styling:**
- Sidebar background: `bg.secondary.default` (gray-900) or darker
- Active item background: `bg.active` (gray-800)
- Active item indicator: Brand color accent (purple)
- Text: `tx.secondary.default`, active text: `tx.primary` or `tx.brand.primary`
- Divider: `divider` color (#2F3858)

### Pills & Tags

**Component Variants:**
- `Pill-button` - Interactive pill-shaped button
- `pill-tag` - Non-interactive tag/label
- `custom-chip` - Custom chip component
- `Tag` - Standard tag component
- `visibility-tag` - Shows visibility status (public/private)

**Tag Styling:**
- Border radius: `full` (pill shape)
- Padding: 4px 12px (small), 6px 16px (medium)
- Font size: `xs` (12px) or `sm` (14px)
- Font weight: 500 or 600
- Background: Varies by type (semantic colors or gray scale)
- Border: Optional, 1px solid

### Filters & Search

**Filter Components:**
- `filter-check-autocomplete` - Checkbox-based filter
- `filter-avatar-check-autocomplete` - With avatar display
- `Filter-pills-buttons` - Pill-style filter buttons
- `Top-filter` - Top-level filter bar
- `data-range-picker` - Date range selection
- `datepicker` - Single date picker

**Search Components:**
- Typically paired with filter components
- Icon: Search icon from icon library
- Input style: Matches text field specifications

---

## Interactions & States

### Hover States
- **Buttons:** Background and/or text color change, subtle scale (optional)
- **Links:** Color change, optional underline appearance
- **Table Rows:** Background change to `bg.primary.hover` (gray-800)
- **Cards:** Optional subtle shadow increase or border color change
- **Icons:** Color change to lighter shade or brand color

### Focus States
- **Inputs:** Purple focus ring (`boxShadow.default`)
- **Buttons (Contained):** White glow (`boxShadow.contained-focused`)
- **Links:** Outline or color change
- **Interactive Elements:** Visible focus indicator (WCAG compliance)

### Active States
- **Buttons:** Slightly darker background or inset shadow
- **Navigation Items:** Brand color accent bar + `bg.active` background
- **Toggle Switches:** Brand color fill
- **Checkboxes/Radio:** Brand color with checkmark

### Disabled States
- **Buttons:** Gray background (`bg.disabled.default`), gray text (`tx.disabled`)
- **Inputs:** Gray border (`border.disabled.default`), reduced opacity
- **Text:** `tx.disabled` (gray-500)
- **Interactive Elements:** Cursor set to `not-allowed`, reduced opacity (typically 0.5-0.6)

### Loading States
- **Spinners:** Typically use brand colors (purple) or white
- **Skeleton Loaders:** Gray gradients (`gray-800` to `gray-700`)
- **Progressive Loading:** Fade-in animations

### Transitions & Animations
```typescript
Transitions: {
  // Color transitions
  colorTransition: 'color 0.3s ease'
  
  // Background transitions
  backgroundTransition: 'background-color 0.3s ease'
  
  // Transform transitions
  transformTransition: 'transform 0.2s ease'
  
  // Combined transitions
  buttonTransition: 'background-color 0.3s ease, transform 0.2s ease'
}
```

**Animation Library:** `tw-animate-css` (Tailwind animations)

---

## Accessibility

### WCAG 2.1 AA Compliance

#### Color Contrast Ratios
- **Normal Text (< 18px):** Minimum 4.5:1
- **Large Text (≥ 18px):** Minimum 3:1
- **UI Components:** Minimum 3:1

**Key Contrasts:**
- white on gray-950: ~18:1 ✓
- gray-25 on gray-950: ~14:1 ✓
- gray-300 on gray-800: ~4.5:1 ✓
- brand-400 (#9667ED) on gray-950: ~7:1 ✓

#### Keyboard Navigation
- All interactive elements are keyboard accessible
- Visible focus indicators on all focusable elements
- Logical tab order throughout the application
- Skip links for main navigation

#### Screen Reader Support
- Semantic HTML elements (header, nav, main, article, etc.)
- ARIA labels and roles where appropriate
- Alt text for all informative images
- Proper heading hierarchy (H1 → H2 → H3, etc.)

#### Form Accessibility
- Labels associated with all inputs
- Error messages linked to inputs
- Required fields indicated
- Help text provided where needed

---

## Technical Implementation

### Styling Architecture

#### Material-UI (MUI) Theming
```typescript
// Primary theming approach
import { ThemeOptions } from '@mui/material/styles';
import { AdditionalThemeOptions } from './theme-options';

const darkThemeOptions: ThemeOptions & AdditionalThemeOptions = {
  // Complete theme configuration
  palette: { /* custom palette */ },
  typography: { /* custom typography */ },
  components: { /* component overrides */ }
};
```

**Location:** `libs/app/app-zephyr-styles/src/themes/`

#### TSS-React (TypeScript Styles)
```typescript
// Component-level styling
import { makeStyles } from 'tss-react/mui';

export const useStyles = makeStyles()((theme) => ({
  button: {
    padding: theme.spacing(1),
    borderRadius: theme.borderRadius['4xl'],
    // ... more styles
  }
}));
```

#### Tailwind CSS
- **Version:** 4.1.11
- **Config:** `postcss.config.js`
- **Usage:** Utility classes for rapid prototyping and simple layouts
- **Import:** `@import 'tailwindcss' source(none);`

### Design Tokens
**File:** `libs/app/app-zephyr-styles/src/themes/tokens.ts`

All color values, shadows, and constants are defined in a central tokens file:
```typescript
export const tokens = {
  'brand-400': '#9667ED',
  'gray-950': '#090807',
  'box-shadow-default': '0px 1px 2px 0px ...',
  // ... all tokens
} as const;
```

### TypeScript Type Safety
Custom palette types ensure type safety throughout the application:
```typescript
export interface CustomPalette {
  tx: TextType;
  border: BorderType;
  fg: ForegroundType;
  bg: BackgroundType;
  brand: Record<BrandKeys, ...>;
  divider: string;
  white: string;
}
```

### Module Structure
- **Monorepo:** Nx workspace
- **Component Libraries:** `libs/app/app-zephyr-components/`
- **Styles:** `libs/app/app-zephyr-styles/`
- **Icons:** `libs/app/app-zephyr-icons/`
- **Forms:** `libs/app/app-zephyr-forms/`
- **Pages:** `libs/app/app-zephyr-pages/`

### Micro-Frontend Architecture
- **MFE Modules:** `mfe/` directory
  - deployment-integrations
  - intercom-chat
  - org-root-overview
  - release-pipeline
  - subscriptions
  - ui
  - user-profile
- **Module Federation:** `@module-federation/enhanced` ~0.8.5
- **Build Tool:** Rspack 1.4.11

---

## Usage Guidelines

### When to Use Each Color

#### Brand Purple (Primary)
- **Use:** Primary CTAs, key features, brand moments, focus states
- **Don't Use:** Large background areas, body text, secondary actions

#### Gray Scale
- **Use:** Backgrounds, text (various shades), borders, dividers, neutral elements
- **Don't Use:** For semantic meaning (success, error, warning)

#### Turquoise
- **Use:** Success indicators, positive metrics, growth, completion states
- **Don't Use:** Error states, warnings, primary navigation

#### Blue
- **Use:** Links, informational messages, neutral highlights
- **Don't Use:** Primary buttons (use brand purple instead)

#### Orange
- **Use:** Warning states, pending actions, caution indicators
- **Don't Use:** Success messages, destructive actions

#### Pink/Red
- **Use:** Error states, destructive actions, critical alerts, deletions
- **Don't Use:** Success messages, informational content

### Component Selection Guide

#### Buttons
- **Contained (Primary):** Main action, highest emphasis (e.g., "Save", "Submit", "Create")
- **Outlined (Secondary):** Secondary actions, medium emphasis (e.g., "Cancel", "Back")
- **Text (Tertiary):** Tertiary actions, low emphasis (e.g., "Learn More", "Skip")

#### Modals
- **Use When:** Requiring user input, confirming destructive actions, displaying critical information
- **Avoid When:** Can use inline forms or notifications instead

#### Cards
- **Use When:** Grouping related information, displaying items in a grid or list
- **Design:** Keep content scannable, use consistent spacing, include clear actions

#### Tables
- **AgGrid:** Complex data with extensive sorting/filtering needs
- **TanStack Table:** Standard tables with moderate interactivity
- **VirtualTable:** Large datasets requiring performance optimization

### Responsive Design

#### Breakpoints
Follow Material-UI default breakpoints:
```typescript
xs: 0px      // Extra small (mobile)
sm: 600px    // Small (tablet portrait)
md: 900px    // Medium (tablet landscape)
lg: 1200px   // Large (desktop)
xl: 1536px   // Extra large (large desktop)
```

#### Mobile Considerations
- **Logo:** `LogoMobileZephyr` for mobile header
- **Navigation:** Collapsible sidebar, hamburger menu
- **Tables:** Horizontal scroll or card view
- **Forms:** Full-width inputs, stacked layouts
- **Buttons:** Larger touch targets (minimum 44x44px)

### Performance Best Practices

#### Lazy Loading
- Use `LazyLoadedComponent` for code splitting
- Lazy load routes with TanStack Router
- Lazy load MFE modules

#### Virtualization
- Use virtualized tables for 100+ rows
- Use `react-virtuoso` or TanStack Virtual for long lists

#### Image Optimization
- Use `react-image-file-resizer` for uploads
- Optimize SVG icons
- Use appropriate image formats (WebP, AVIF)

#### Component Optimization
- Memoize expensive components
- Use React 18 features (useTransition, useDeferredValue)
- Avoid unnecessary re-renders

---

## Appendix

### File Structure Reference
```
libs/app/
├── app-zephyr-styles/          # Design system & theming
│   └── src/
│       ├── themes/
│       │   ├── tokens.ts       # Design tokens
│       │   ├── theme-options.ts # MUI theme config
│       │   └── types.d.ts      # Type definitions
│       └── pages/              # Page-specific styles
├── app-zephyr-components/      # Component library
│   └── src/
│       ├── Button/
│       ├── Link/
│       ├── Card/
│       ├── Table/
│       └── ... (100+ components)
├── app-zephyr-icons/           # Icon library
│   └── src/                    # 90+ SVG icon components
├── app-zephyr-forms/           # Form components
└── ...
```

### External Resources
- **Material-UI Documentation:** https://mui.com/
- **TanStack Query:** https://tanstack.com/query/latest
- **TanStack Router:** https://tanstack.com/router/latest
- **Tailwind CSS:** https://tailwindcss.com/
- **Nx Monorepo:** https://nx.dev/

### Changelog
- **v2.8.0** (Current) - Full design system documentation
- Design tokens centralized
- Component library standardized
- Accessibility guidelines added

---

## Notes for Developers

### Getting Started with the Design System

1. **Import Theme:**
   ```typescript
   import { darkThemeOptions } from '@app-zephyr-styles';
   ```

2. **Use Theme in Components:**
   ```typescript
   import { useTheme } from '@mui/material';
   const theme = useTheme();
   const color = theme.palette.tx.primary;
   ```

3. **Use Design Tokens:**
   ```typescript
   import { tokens } from '@app-zephyr-styles';
   const brandColor = tokens['brand-400'];
   ```

4. **Create Styled Components:**
   ```typescript
   import { makeStyles } from 'tss-react/mui';
   const useStyles = makeStyles()((theme) => ({
     root: {
       color: theme.palette.tx.primary,
       backgroundColor: theme.palette.bg.primary.default
     }
   }));
   ```

### Design Reviews
All new features should be reviewed for:
- [ ] Color usage matches design system
- [ ] Typography follows specifications
- [ ] Spacing uses consistent scale
- [ ] Components use existing library where possible
- [ ] Accessibility requirements met
- [ ] Responsive design implemented
- [ ] Performance optimized

### Design System Updates
To propose changes to the design system:
1. Open a discussion in the team channel
2. Create RFC document if significant change
3. Get approval from design and engineering leads
4. Update this PRD document
5. Update component library and theme files
6. Document migration path if breaking change

---

**End of PRD Document**

For questions or suggestions, contact the Design & Engineering team.


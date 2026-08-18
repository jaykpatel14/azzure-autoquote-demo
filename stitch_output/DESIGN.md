---
name: Azzure AutoQuote
colors:
  surface: '#f9f9ff'
  surface-dim: '#d7dae4'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f3fe'
  surface-container: '#ebedf8'
  surface-container-high: '#e6e8f3'
  surface-container-highest: '#e0e2ed'
  on-surface: '#181c23'
  on-surface-variant: '#414754'
  inverse-surface: '#2d3039'
  inverse-on-surface: '#eef0fb'
  outline: '#717786'
  outline-variant: '#c1c6d7'
  surface-tint: '#005cbc'
  primary: '#005ab7'
  on-primary: '#ffffff'
  primary-container: '#0072e5'
  on-primary-container: '#fefcff'
  inverse-primary: '#abc7ff'
  secondary: '#5c5e66'
  on-secondary: '#ffffff'
  secondary-container: '#dfdfe9'
  on-secondary-container: '#61626b'
  tertiary: '#5b5c5c'
  on-tertiary: '#ffffff'
  tertiary-container: '#747575'
  on-tertiary-container: '#fdfcfc'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d7e2ff'
  primary-fixed-dim: '#abc7ff'
  on-primary-fixed: '#001b3f'
  on-primary-fixed-variant: '#004590'
  secondary-fixed: '#e2e2ec'
  secondary-fixed-dim: '#c5c6cf'
  on-secondary-fixed: '#191b22'
  on-secondary-fixed-variant: '#45464e'
  tertiary-fixed: '#e3e2e2'
  tertiary-fixed-dim: '#c6c6c6'
  on-tertiary-fixed: '#1a1c1c'
  on-tertiary-fixed-variant: '#464747'
  background: '#f9f9ff'
  on-background: '#181c23'
  surface-variant: '#e0e2ed'
typography:
  display-lg:
    fontFamily: Playfair Display
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  display-md:
    fontFamily: Playfair Display
    fontSize: 36px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Playfair Display
    fontSize: 30px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  title-lg:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: 0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 16px
  md: 24px
  lg: 40px
  xl: 64px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
---

## Brand & Style
The design system for this platform blends high-end editorial luxury with the clinical precision of a B2B SaaS tool. It targets luxury jewelry retailers who demand both aesthetic sophistication and high-performance functionality. 

The visual style is **Luxury-Tech Modern**, a hybrid that utilizes **Minimalism** to create focus and **Glassmorphism** to signify depth and premium quality. The interface should feel like a digital boutique—airy, expensive, and meticulously organized. Use generous whitespace to allow product photography to breathe, while maintaining a rigid underlying grid that communicates reliability and technical accuracy.

## Colors
The palette is anchored by **Azure Blue** for primary actions and **Midnight Slate** for structural components and high-contrast typography. 

- **Primary (Azure Blue):** Reserved for intent, primary buttons, and active states. It bridges the gap between traditional luxury and modern technology.
- **Secondary (Midnight Slate):** Used for navigation backgrounds, headers, and deep contrast elements to ground the UI.
- **Metallics (Silver & Gold):** Used sparingly as accents for status indicators, border highlights on premium cards, and specialized jewelry swatches.
- **Surfaces:** A combination of pure white (#FFFFFF) and **Soft Neutrals** (#F8F9FA) creates a layered, "gallery-style" environment. Glassmorphism is applied to floating panels and navigation overlays using a 12% opacity Azure or Slate tint with a 20px backdrop blur.

## Typography
This system employs a dual-typeface strategy to balance brand emotion with utility.

- **Editorial Layer:** Use **Playfair Display** for high-impact moments—landing sections, quote summaries, and luxury product titles. This evokes a sense of heritage and exclusivity.
- **Utility Layer:** Use **Inter** for all data-heavy interfaces, administrative dashboards, and inputs. It provides the clarity and precision required for B2B logistics.
- **Hierarchy:** Maintain high contrast between Serif headlines and Sans-serif subheaders. Use tracking (letter-spacing) on labels to enhance the professional, "engineered" feel of the UI.

## Layout & Spacing
The layout follows a **Fluid Grid** model with strict adherence to an 8px spacing system to ensure technical precision.

- **Desktop:** 12-column grid with 24px gutters and 48px outer margins. This allows for complex data layouts while maintaining an "airy" feel.
- **Tablet:** 8-column grid with 24px gutters.
- **Mobile:** 4-column grid with 16px margins.
- **Philosophy:** Favor "Over-spacing." In luxury design, whitespace is a commodity. Use `xl` (64px) spacing between major sections to prevent the UI from feeling cluttered or "cheap."

## Elevation & Depth
Hierarchy is established through **Tonal Layers** and **Subtle Shadows**. 

1. **Base:** Soft Neutral (#F8F9FA) background.
2. **Floor:** Pure White surfaces with a 1px border in #E9ECEF (no shadow). Use this for standard layout sections.
3. **Lifted:** Cards and interactive containers use an **Ambient Shadow**: `0 4px 20px rgba(26, 28, 35, 0.06)`.
4. **Floating:** Glassmorphic overlays (modals, dropdowns) use a 20px backdrop blur and a `1px` inner border (top/left) in a light blue tint to simulate light hitting glass.

## Shapes
The shape language is **Soft (0.25rem)**. While consumer apps often use high-radius pills, this system uses subtle corner rounding to maintain a professional, architectural, and "cut" aesthetic—reminiscent of gemstone faceting.

- **Standard Buttons/Inputs:** 4px (Soft) radius.
- **Product Cards:** 8px (Large) radius.
- **AI-Status Indicators:** Fully circular (Pill) to distinguish organic/dynamic intelligence from static data.

## Components

- **Buttons:** Primary buttons use a subtle gradient from Azure Blue to a slightly deeper shade. Labels are always `label-sm` (uppercase) for a professional look. Secondary buttons use a Midnight Slate "Ghost" style (border only).
- **Luxury Jewelry Swatches:** Rectangular containers with 4px radius. They must include a subtle metallic inner-shadow to give depth to gold/silver/platinum indicators.
- **Data Tables:** High-density but high-clarity. Use Midnight Slate for headers and Azure Blue for interactive text/links. Row hover states should use the Soft Neutral surface color.
- **AI-Status Indicators:** Use a pulsating glow effect using the Azure Blue primary color at 20% opacity. This indicates "AutoQuote" intelligence is processing.
- **Input Fields:** Use a floating label pattern. On focus, the border transitions from Neutral to a 2px Azure Blue, and the background remains White to ensure legibility.
- **Cards:** Premium cards feature a 1px metallic silver top-border and the Ambient Shadow defined in the Elevation section.

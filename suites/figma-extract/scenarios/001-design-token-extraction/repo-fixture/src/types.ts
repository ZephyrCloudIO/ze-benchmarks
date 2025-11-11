/**
 * Design token types
 */

export interface ColorToken {
  name: string;
  value: string; // hex color
}

export interface TypographyToken {
  name: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
}

export interface SpacingToken {
  name: string;
  value: number; // pixels
}

export interface EffectToken {
  name: string;
  type: 'shadow' | 'blur';
  color?: string;
  offsetX?: number;
  offsetY?: number;
  radius?: number;
  spread?: number;
}

export interface DesignTokens {
  colors: ColorToken[];
  typography: TypographyToken[];
  spacing: SpacingToken[];
  effects: EffectToken[];
}

export interface FigmaFile {
  document: FigmaDocument;
  styles?: Record<string, FigmaStyle>;
}

export interface FigmaDocument {
  id: string;
  name: string;
  type: string;
  children: FigmaNode[];
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  fills?: FigmaFill[];
  style?: FigmaTextStyle;
  absoluteBoundingBox?: FigmaBoundingBox;
  effects?: FigmaEffect[];
}

export interface FigmaFill {
  type: string;
  color?: FigmaColor;
}

export interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface FigmaTextStyle {
  fontFamily?: string;
  fontWeight?: number;
  fontSize?: number;
  lineHeightPx?: number;
  letterSpacing?: number;
}

export interface FigmaBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FigmaEffect {
  type: string;
  color?: FigmaColor;
  offset?: { x: number; y: number };
  radius?: number;
  spread?: number;
}

export interface FigmaStyle {
  key: string;
  name: string;
  styleType: string;
  fills?: FigmaFill[];
  fontFamily?: string;
  fontWeight?: number;
  fontSize?: number;
  lineHeightPx?: number;
}

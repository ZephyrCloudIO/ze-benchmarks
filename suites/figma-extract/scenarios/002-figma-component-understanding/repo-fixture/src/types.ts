/**
 * Component classification and analysis types
 */

export type ComponentType = 
  | 'button'
  | 'input'
  | 'card'
  | 'avatar'
  | 'badge'
  | 'checkbox'
  | 'toggle'
  | 'alert'
  | 'unknown';

export interface ComponentVariant {
  name: string;
  properties: Record<string, string>;
}

export interface ComponentAnalysis {
  id: string;
  name: string;
  type: ComponentType;
  variants: ComponentVariant[];
  properties: ComponentProperty[];
  children: ComponentChild[];
}

export interface ComponentProperty {
  name: string;
  value: string | number | boolean;
  type: 'color' | 'spacing' | 'text' | 'boolean' | 'number';
}

export interface ComponentChild {
  id: string;
  name: string;
  type: string;
}

export interface FigmaFile {
  document: FigmaDocument;
  components?: Record<string, FigmaComponent>;
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
  fills?: any[];
  strokes?: any[];
  cornerRadius?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  absoluteBoundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface FigmaComponent {
  key: string;
  name: string;
  description?: string;
}

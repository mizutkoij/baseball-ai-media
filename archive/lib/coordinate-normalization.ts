/**
 * Coordinate Normalization for Baseball Pitch Location
 * Converts pixel coordinates to standardized plate coordinates
 */

export interface PlateCoordinates {
  plateX: number;    // -0.83 to +0.83 (left/right from catcher's perspective)
  plateZ: number;    // 0.5 to 3.5 (low/high)
  zone?: string;     // '内角高め' | '真ん中低め' etc.
}

export interface PixelCoordinates {
  x: number;         // Pixel X position
  y: number;         // Pixel Y position
}

export interface BoundingBox {
  x: number;         // Left edge
  y: number;         // Top edge  
  width: number;     // Width
  height: number;    // Height
}

/**
 * Standard NPB strike zone dimensions (in feet)
 */
export const STRIKE_ZONE = {
  width: 17 / 12,    // 17 inches = 1.42 feet
  height: 3.0,       // Approximate height (knees to chest)
  plateWidth: 1.66   // Total plate coverage area
} as const;

/**
 * Zone classification system
 */
export const ZONE_GRID = {
  horizontal: ['外角', '真ん中', '内角'] as const,
  vertical: ['低め', '中', '高め'] as const
} as const;

/**
 * Normalize pixel coordinates to plate coordinates
 */
export function normalizeToPlateCoordinates(
  pixel: PixelCoordinates,
  boundingBox: BoundingBox
): PlateCoordinates {
  // Convert to 0-1 normalized coordinates
  const u = (pixel.x - boundingBox.x) / boundingBox.width;
  const v = 1 - (pixel.y - boundingBox.y) / boundingBox.height; // Flip Y (top=high)
  
  // Map to plate coordinates
  const plateX = (u - 0.5) * STRIKE_ZONE.plateWidth;  // -0.83 to +0.83
  const plateZ = 0.5 + v * 3.0;                       // 0.5 to 3.5
  
  // Classify zone
  const zone = classifyZone(plateX, plateZ);
  
  return {
    plateX: Math.round(plateX * 1000) / 1000,   // Round to 3 decimal places
    plateZ: Math.round(plateZ * 1000) / 1000,
    zone
  };
}

/**
 * Classify plate coordinates into zone names
 */
export function classifyZone(plateX: number, plateZ: number): string {
  // Horizontal classification (from catcher's perspective)
  let horizontal: string;
  if (plateX < -0.28) {
    horizontal = '外角';      // Outside (left from catcher)
  } else if (plateX > 0.28) {
    horizontal = '内角';      // Inside (right from catcher)  
  } else {
    horizontal = '真ん中';    // Middle
  }
  
  // Vertical classification
  let vertical: string;
  if (plateZ < 1.5) {
    vertical = '低め';        // Low
  } else if (plateZ > 2.5) {
    vertical = '高め';        // High
  } else {
    vertical = '中';          // Middle
  }
  
  return `${horizontal}${vertical}`;
}

/**
 * Extract bounding box from Yahoo chart elements
 */
export function extractYahooBoundingBox(
  chartElement: any, // cheerio element or DOM element
  coordinateElements: any[] // Array of pitch coordinate elements
): BoundingBox | null {
  try {
    // Method 1: From chart container style/attributes
    const style = chartElement.attr?.('style') || chartElement.style?.cssText || '';
    const widthMatch = style.match(/width:\s*(\d+)px/);
    const heightMatch = style.match(/height:\s*(\d+)px/);
    
    if (widthMatch && heightMatch) {
      return {
        x: 0,
        y: 0,
        width: parseInt(widthMatch[1]),
        height: parseInt(heightMatch[1])
      };
    }
    
    // Method 2: From coordinate elements boundaries
    if (coordinateElements.length > 0) {
      const coords = coordinateElements.map(el => {
        const style = el.attr?.('style') || el.style?.cssText || '';
        const topMatch = style.match(/top:\s*(\d+(?:\.\d+)?)px/);
        const leftMatch = style.match(/left:\s*(\d+(?:\.\d+)?)px/);
        
        if (topMatch && leftMatch) {
          return {
            x: parseFloat(leftMatch[1]),
            y: parseFloat(topMatch[1])
          };
        }
        return null;
      }).filter(c => c !== null);
      
      if (coords.length >= 2) {
        const xs = coords.map(c => c!.x);
        const ys = coords.map(c => c!.y);
        
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        
        return {
          x: minX - 10,  // Add some padding
          y: minY - 10,
          width: (maxX - minX) + 20,
          height: (maxY - minY) + 20
        };
      }
    }
    
    // Method 3: Default/fallback dimensions
    return {
      x: 0,
      y: 0,
      width: 200,
      height: 200
    };
    
  } catch (error) {
    console.warn('Failed to extract Yahoo bounding box:', error);
    return null;
  }
}

/**
 * Extract bounding box from baseballdata.jp charts
 */
export function extractBaseballDataBoundingBox(
  chartContainer: any,
  scriptContent?: string
): BoundingBox | null {
  try {
    // Method 1: From chart configuration in script
    if (scriptContent) {
      // Look for chart dimensions in JavaScript
      const widthMatch = scriptContent.match(/width[\s:]*(\d+)/);
      const heightMatch = scriptContent.match(/height[\s:]*(\d+)/);
      
      if (widthMatch && heightMatch) {
        return {
          x: 0,
          y: 0,
          width: parseInt(widthMatch[1]),
          height: parseInt(heightMatch[1])
        };
      }
      
      // Look for SVG viewBox
      const viewBoxMatch = scriptContent.match(/viewBox[\s:]*["']0 0 (\d+) (\d+)["']/);
      if (viewBoxMatch) {
        return {
          x: 0,
          y: 0,
          width: parseInt(viewBoxMatch[1]),
          height: parseInt(viewBoxMatch[2])
        };
      }
    }
    
    // Method 2: From chart container attributes
    const width = chartContainer.attr?.('data-width') || chartContainer.attr?.('width');
    const height = chartContainer.attr?.('data-height') || chartContainer.attr?.('height');
    
    if (width && height) {
      return {
        x: 0,
        y: 0,
        width: parseInt(width),
        height: parseInt(height)
      };
    }
    
    // Method 3: Common baseballdata.jp chart dimensions
    return {
      x: 0,
      y: 0,
      width: 300,
      height: 300
    };
    
  } catch (error) {
    console.warn('Failed to extract baseballdata bounding box:', error);
    return null;
  }
}

/**
 * Coordinate confidence assessment
 */
export function assessCoordinateConfidence(
  plateCoords: PlateCoordinates,
  source: 'yahoo' | 'baseballdata',
  boundingBox?: BoundingBox
): 'high' | 'medium' | 'low' {
  // Check if coordinates are within reasonable bounds
  const inBounds = (
    plateCoords.plateX >= -1.5 && plateCoords.plateX <= 1.5 &&
    plateCoords.plateZ >= 0.0 && plateCoords.plateZ <= 4.0
  );
  
  if (!inBounds) {
    return 'low';
  }
  
  // Yahoo coordinates are generally more reliable
  if (source === 'yahoo') {
    return boundingBox && boundingBox.width > 150 ? 'high' : 'medium';
  }
  
  // baseballdata.jp coordinates need more validation
  if (source === 'baseballdata') {
    return boundingBox && boundingBox.width > 200 ? 'medium' : 'low';
  }
  
  return 'medium';
}

/**
 * Merge coordinates from multiple sources
 */
export function mergeCoordinates(
  yahooCoords?: PlateCoordinates | null,
  baseballDataCoords?: PlateCoordinates | null,
  confidence?: { yahoo?: string; baseballData?: string }
): { coordinates: PlateCoordinates | null; source: string; confidence: string } {
  // Prefer Yahoo coordinates if available and high confidence
  if (yahooCoords && confidence?.yahoo === 'high') {
    return {
      coordinates: yahooCoords,
      source: 'yahoo',
      confidence: 'high'
    };
  }
  
  // Use baseballdata if Yahoo not available or low confidence
  if (baseballDataCoords && confidence?.baseballData !== 'low') {
    return {
      coordinates: baseballDataCoords,
      source: 'baseballdata',
      confidence: confidence?.baseballData || 'medium'
    };
  }
  
  // Fallback to Yahoo even if lower confidence
  if (yahooCoords) {
    return {
      coordinates: yahooCoords,
      source: 'yahoo',
      confidence: confidence?.yahoo || 'medium'
    };
  }
  
  // No coordinates available
  return {
    coordinates: null,
    source: 'none',
    confidence: 'low'
  };
}

/**
 * Validate coordinate consistency between sources
 */
export function validateCoordinateConsistency(
  yahooCoords?: PlateCoordinates | null,
  baseballDataCoords?: PlateCoordinates | null,
  tolerance: number = 0.2
): {
  isConsistent: boolean;
  distance?: number;
  flags: string[];
} {
  if (!yahooCoords || !baseballDataCoords) {
    return { isConsistent: true, flags: [] };
  }
  
  const distance = Math.sqrt(
    Math.pow(yahooCoords.plateX - baseballDataCoords.plateX, 2) +
    Math.pow(yahooCoords.plateZ - baseballDataCoords.plateZ, 2)
  );
  
  const flags: string[] = [];
  
  if (distance > tolerance) {
    flags.push('coordinate_mismatch');
    
    if (Math.abs(yahooCoords.plateX - baseballDataCoords.plateX) > tolerance) {
      flags.push('mismatch_horizontal');
    }
    
    if (Math.abs(yahooCoords.plateZ - baseballDataCoords.plateZ) > tolerance) {
      flags.push('mismatch_vertical');
    }
  }
  
  // Zone consistency check
  if (yahooCoords.zone !== baseballDataCoords.zone) {
    flags.push('mismatch_zone');
  }
  
  return {
    isConsistent: distance <= tolerance,
    distance,
    flags
  };
}

/**
 * Convert legacy zone names to standardized format
 */
export function normalizeZoneName(zoneName: string): string {
  const normalized = zoneName
    .replace(/[（）()]/g, '')
    .replace(/ゾーン/g, '')
    .replace(/エリア/g, '')
    .trim();
  
  // Mapping table for common variations
  const zoneMap: Record<string, string> = {
    '左': '外角',
    '右': '内角',
    'アウト': '外角',
    'イン': '内角',
    'アウトサイド': '外角',
    'インサイド': '内角',
    '上': '高め',
    '下': '低め',
    'ハイ': '高め',
    'ロー': '低め',
    'ミドル': '中',
    'センター': '真ん中'
  };
  
  for (const [key, value] of Object.entries(zoneMap)) {
    if (normalized.includes(key)) {
      return normalized.replace(key, value);
    }
  }
  
  return normalized;
}
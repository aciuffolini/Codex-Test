/**
 * KMZ Loader for Google Earth
 * Loads and parses KMZ files to extract KML data
 */

import JSZip from 'jszip';

export interface KMZPlacemark {
  name: string;
  coordinates: Array<{ lat: number; lon: number; alt?: number }>;
  type: "polygon" | "line" | "point";
}

export interface KMZData {
  placemarks: KMZPlacemark[];
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

export class KMZLoader {
  /**
   * Load and parse KMZ file
   */
  static async loadKMZ(file: File): Promise<KMZData> {
    // KMZ is a ZIP file containing KML
    const zip = await this.unzipKMZ(file);
    const kmlContent = await this.extractKML(zip);
    return this.parseKML(kmlContent);
  }

  /**
   * Unzip KMZ file (KMZ is just a ZIP with .kmz extension)
   */
  private static async unzipKMZ(file: File): Promise<Map<string, Blob>> {
    try {
      // Check file extension first
      const isKMZ = file.name.toLowerCase().endsWith('.kmz');
      
      if (isKMZ) {
        // It's a KMZ (ZIP file) - use JSZip
        const arrayBuffer = await file.arrayBuffer();
        
        // Check ZIP magic bytes (PK header)
        const view = new Uint8Array(arrayBuffer);
        const isZIP = view[0] === 0x50 && view[1] === 0x4B; // "PK"
        
        if (!isZIP) {
          throw new Error("File has .kmz extension but is not a valid ZIP file");
        }
        
        const zip = await JSZip.loadAsync(arrayBuffer);
        const map = new Map<string, Blob>();
        
        // Extract all files from ZIP
        for (const [filename, fileEntry] of Object.entries(zip.files)) {
          if (!fileEntry.dir && filename.endsWith('.kml')) {
            const content = await fileEntry.async('blob');
            map.set(filename, content);
          }
        }
        
        if (map.size === 0) {
          throw new Error("No KML file found in KMZ archive");
        }
        
        return map;
      } else {
        // It's a KML (text) file - parse directly
        const text = await file.text();
        
        if (!text.includes("<?xml") && !text.includes("<kml")) {
          throw new Error("File does not appear to be a valid KML file");
        }
        
        const blob = new Blob([text], { type: "application/vnd.google-earth.kml+xml" });
        const map = new Map<string, Blob>();
        map.set("doc.kml", blob);
        return map;
      }
    } catch (err: any) {
      if (err.message.includes("JSZip") || err.message.includes("jszip")) {
        throw new Error("KMZ support requires JSZip. Please use KML file instead, or install JSZip: npm install jszip");
      }
      throw new Error(`Failed to load KMZ/KML: ${err.message}`);
    }
  }

  /**
   * Extract KML content from ZIP
   */
  private static async extractKML(zip: Map<string, Blob>): Promise<string> {
    // Find KML file (usually doc.kml)
    const kmlBlob = zip.get("doc.kml") || 
                    Array.from(zip.values()).find(blob => blob.type.includes("kml")) ||
                    Array.from(zip.values())[0];
    
    if (!kmlBlob) {
      throw new Error("No KML file found in KMZ");
    }

    return await kmlBlob.text();
  }

  /**
   * Parse KML content
   */
  private static parseKML(kmlContent: string): KMZData {
    const parser = new DOMParser();
    const doc = parser.parseFromString(kmlContent, "text/xml");

    const placemarks: KMZPlacemark[] = [];
    let north = -90, south = 90, east = -180, west = 180;

    // Find all Placemarks
    const placemarkElements = doc.querySelectorAll("Placemark");
    
    placemarkElements.forEach((placemark) => {
      const name = placemark.querySelector("name")?.textContent || "Unnamed";
      
      // Try to find coordinates
      const coordText = placemark.querySelector("coordinates")?.textContent;
      if (!coordText) return;

      const coords = this.parseCoordinates(coordText);
      if (coords.length === 0) return;

      // Determine type
      let type: "polygon" | "line" | "point" = "point";
      if (placemark.querySelector("Polygon")) {
        type = "polygon";
      } else if (placemark.querySelector("LineString")) {
        type = "line";
      }

      placemarks.push({
        name,
        coordinates: coords,
        type,
      });

      // Update bounds
      coords.forEach(coord => {
        north = Math.max(north, coord.lat);
        south = Math.min(south, coord.lat);
        east = Math.max(east, coord.lon);
        west = Math.min(west, coord.lon);
      });
    });

    return {
      placemarks,
      bounds: { north, south, east, west },
    };
  }

  /**
   * Parse coordinate string from KML
   */
  private static parseCoordinates(coordText: string): Array<{ lat: number; lon: number; alt?: number }> {
    const coords: Array<{ lat: number; lon: number; alt?: number }> = [];
    
    // KML format: "lon,lat,alt lon,lat,alt ..."
    const parts = coordText.trim().split(/\s+/);
    
    for (const part of parts) {
      const [lon, lat, alt] = part.split(",").map(Number);
      if (!isNaN(lat) && !isNaN(lon)) {
        coords.push({
          lat,
          lon,
          alt: alt && !isNaN(alt) ? alt : undefined,
        });
      }
    }

    return coords;
  }
}


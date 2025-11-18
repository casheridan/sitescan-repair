# GIS Integration Guide

This guide explains how to integrate real Geographic Information System (GIS) data with the sewer inspection map.

## Current Status

Currently, the map uses **simulated coordinates** distributed randomly around Hays, Kansas. The heatmap and markers are based on real OPRI data from your inspection reports, but the locations are approximate.

## Integration Options

### Option 1: ArcGIS Geocoding Service (Recommended for Hays, KS)

ArcGIS provides high-quality geocoding services that can convert street addresses to coordinates.

#### Setup:

1. **Get ArcGIS API Key**
   - Sign up at https://developers.arcgis.com/
   - Create an API key with geocoding permissions

2. **Install ArcGIS SDK**
   ```bash
   npm install @esri/arcgis-rest-request @esri/arcgis-rest-geocoding
   ```

3. **Update MapView.js**

Replace the `geocodeReports` function with:

```javascript
import { geocode } from '@esri/arcgis-rest-geocoding';
import { ApiKeyManager } from '@esri/arcgis-rest-request';

const authentication = ApiKeyManager.fromKey('YOUR_API_KEY');

const geocodeReports = async (reports) => {
  const geocoded = [];
  const heatPoints = [];
  let geocodedCount = 0;

  for (const report of reports) {
    if (!report.street || !report.city) continue;
    
    try {
      const result = await geocode({
        address: report.street,
        city: report.city || 'Hays',
        region: 'KS',
        authentication
      });

      if (result.candidates && result.candidates.length > 0) {
        const { x: lng, y: lat } = result.candidates[0].location;
        
        geocodedCount++;
        geocoded.push({
          ...report,
          lat,
          lng
        });

        if (report.opri && report.opri !== 'N/A') {
          heatPoints.push([lat, lng, report.opri]);
        }
      }
    } catch (error) {
      console.error(`Failed to geocode ${report.street}:`, error);
    }
  }

  setMapData(geocoded);
  setHeatmapPoints(heatPoints);
  setGeoStats({ total: reports.length, geocoded: geocodedCount });
  setIsGeocoding(false);
};
```

4. **Add caching** to avoid repeated API calls:
   - Store geocoded results in localStorage
   - Check cache before making API requests

### Option 2: Direct Coordinate Integration

If you have a GIS system (ArcGIS, QGIS, etc.) with manhole coordinates:

#### Method A: Export from GIS System

1. Export manhole locations from your GIS system as CSV/JSON:
   ```csv
   manhole_id,latitude,longitude
   138-33-20-028,38.8792,-99.3268
   138-33-20-027,38.8795,-99.3270
   ...
   ```

2. Load the coordinate file in your app:
   ```javascript
   // Add to backend
   const manholeCoords = require('./manhole_coordinates.json');
   
   // Match by manhole ID
   function addCoordinates(report) {
     const coords = manholeCoords[report.upstreamMH];
     if (coords) {
       return { ...report, lat: coords.latitude, lng: coords.longitude };
     }
     return report;
   }
   ```

#### Method B: Add to PDF Parser

Modify the Python parser to extract coordinates if they're in the PDF:

```python
# In pdfParserCamelot.py
lat_match = re.search(r'Latitude:\s*([-\d.]+)', section)
lng_match = re.search(r'Longitude:\s*([-\d.]+)', section)

if lat_match and lng_match:
    report['latitude'] = float(lat_match.group(1))
    report['longitude'] = float(lng_match.group(1))
```

### Option 3: OpenStreetMap Nominatim (Free)

For basic geocoding without API keys:

```javascript
const geocodeWithNominatim = async (address, city) => {
  const query = encodeURIComponent(`${address}, ${city}, Kansas, USA`);
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
    {
      headers: {
        'User-Agent': 'SewerInspectionApp/1.0'
      }
    }
  );
  
  const results = await response.json();
  if (results.length > 0) {
    return {
      lat: parseFloat(results[0].lat),
      lng: parseFloat(results[0].lon)
    };
  }
  return null;
};
```

**Note:** Nominatim has usage limits (1 request/second). Consider caching results.

## ArcGIS Feature Layers (Advanced)

For production deployments with Hays, Kansas city infrastructure:

### 1. Connect to Existing Feature Layer

If Hays city has an ArcGIS feature layer with sewer infrastructure:

```javascript
import { loadModules } from 'esri-loader';

// Load ArcGIS JS API
loadModules([
  'esri/Map',
  'esri/views/MapView',
  'esri/layers/FeatureLayer'
]).then(([Map, MapView, FeatureLayer]) => {
  
  // Add sewer infrastructure layer
  const sewerLayer = new FeatureLayer({
    url: 'https://services.arcgis.com/.../FeatureServer/0',
    outFields: ['*']
  });
  
  map.add(sewerLayer);
});
```

### 2. Spatial Queries

Match inspection reports to manholes using spatial queries:

```javascript
import { queryFeatures } from '@esri/arcgis-rest-feature-service';

// Find manhole by ID
const results = await queryFeatures({
  url: 'https://services.arcgis.com/.../FeatureServer/0',
  where: `MANHOLE_ID = '${report.upstreamMH}'`,
  authentication
});

if (results.features.length > 0) {
  const geometry = results.features[0].geometry;
  // geometry.x = longitude, geometry.y = latitude
}
```

## Data Sources for Hays, Kansas

### City of Hays GIS Data
- Contact: Hays Public Works Department
- Website: https://www.haysusa.com/
- Request: Sewer infrastructure shapefile/feature layer

### Kansas Data Access & Support Center (DASC)
- Website: https://www.kansasgis.org/
- May have regional infrastructure data

### Private Survey Data
- If you have GPS survey data from inspection trucks
- Import directly as coordinate file

## Performance Optimization

For large datasets (>1000 reports):

1. **Clustering**: Group nearby markers
   ```bash
   npm install leaflet.markercluster
   ```

2. **Lazy Loading**: Load only visible markers
3. **Caching**: Cache geocoding results in IndexedDB
4. **Backend Geocoding**: Geocode during PDF parsing

## Testing

Test with a small batch first:
```javascript
// In MapView.js, limit reports for testing
const testReports = reports.slice(0, 50);
geocodeReports(testReports);
```

## Support

For issues with:
- **ArcGIS**: https://developers.arcgis.com/support/
- **Leaflet**: https://leafletjs.com/
- **This App**: Check the main README

## Example: Complete ArcGIS Integration

See `examples/arcgis-integration.js` for a complete working example (coming soon).


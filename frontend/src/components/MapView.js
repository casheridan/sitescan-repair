import React, { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { AlertCircle, Info } from 'lucide-react';
import { geocode } from '@esri/arcgis-rest-geocoding';
import { ApiKeyManager } from '@esri/arcgis-rest-request';

// Fix for default marker icons in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Heatmap Layer Component
function HeatmapLayer({ points }) {
  const map = useMap();
  const heatLayerRef = useRef(null);

  useEffect(() => {
    if (!map || !points || points.length === 0) return;

    // Remove existing heat layer
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
    }

    // Create new heat layer
    // Format: [lat, lng, intensity]
    heatLayerRef.current = L.heatLayer(points, {
      radius: 25,
      blur: 35,
      maxZoom: 17,
      max: 5.0, // Max OPRI value
      gradient: {
        0.0: '#00ff00',   // Green (excellent)
        0.3: '#ffff00',   // Yellow
        0.5: '#ffa500',   // Orange
        0.7: '#ff0000',   // Red (poor)
        1.0: '#8b0000'    // Dark red (very poor)
      }
    }).addTo(map);

    return () => {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
      }
    };
  }, [map, points]);

  return null;
}

// ArcGIS Authentication
const authentication = ApiKeyManager.fromKey('AAPTxy8BH1VEsoebNVZXo8HurLws1MHzI5acd0HQXkihF8U84QbBstSAo5UYM73HQXHYBBlsTLxFe2W4ECVNnuFbPMwahhHebWwmPAPT6Wg7YW1D-ZN53U90ag6yau-Tvh9ybB7ys2lIkmFPd_l7EfmwbAvSCoCFej5DI1fWZEHpj22s9P_SFY57MPqSWjG3XZ6arPand69JFXIgnZWqAz_UZ2N_LnrdUF7QzGGHZTQbT-s.AT1_H1fKKsv5');

// Custom marker icons based on OPRI
const getMarkerIcon = (opri) => {
  let color;
  if (!opri || opri === 'N/A') color = 'gray';
  else if (opri <= 1.5) color = 'green';
  else if (opri <= 2.5) color = 'blue';
  else if (opri <= 3.5) color = 'yellow';
  else if (opri <= 4.5) color = 'orange';
  else color = 'red';

  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: ${color};
      width: 12px;
      height: 12px;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 0 4px rgba(0,0,0,0.5);
    "></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6]
  });
};

function MapView({ data, dataId }) {
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);
  const [mapData, setMapData] = useState([]);
  const [heatmapPoints, setHeatmapPoints] = useState([]);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geoStats, setGeoStats] = useState({ total: 0, geocoded: 0 });
  const [usingCache, setUsingCache] = useState(false);

  // Hays, Kansas coordinates
  const HAYS_CENTER = [38.8792, -99.3268];

  // Generate cache key for geocoded data
  const getCacheKey = useCallback((id) => {
    return `geocoded_map_data_${id}`;
  }, []);

  // Load cached geocoded data
  const loadCachedData = useCallback((id) => {
    try {
      const cacheKey = getCacheKey(id);
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsedData = JSON.parse(cached);
        // Check if cache is still valid (within 7 days)
        const cacheAge = Date.now() - parsedData.timestamp;
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        
        if (cacheAge < sevenDays) {
          console.log('✓ Loaded geocoded data from cache');
          setMapData(parsedData.geocoded);
          setHeatmapPoints(parsedData.heatPoints);
          setGeoStats(parsedData.stats);
          setUsingCache(true);
          return true;
        } else {
          console.log('Cache expired, will re-geocode');
          localStorage.removeItem(cacheKey);
        }
      }
    } catch (error) {
      console.warn('Failed to load cached data:', error);
    }
    return false;
  }, [getCacheKey]);

  // Save geocoded data to cache
  const saveCachedData = useCallback((id, geocoded, heatPoints, stats) => {
    try {
      const cacheKey = getCacheKey(id);
      const cacheData = {
        geocoded,
        heatPoints,
        stats,
        timestamp: Date.now()
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      console.log('✓ Saved geocoded data to cache');
    } catch (error) {
      console.warn('Failed to save cached data:', error);
    }
  }, [getCacheKey]);

  // Geocode inspection reports to get coordinates
  const geocodeReports = useCallback(async (reports, id) => {
    const geocoded = [];
    const heatPoints = [];
    let geocodedCount = 0;
    let arcgisAttempts = 0;

    console.log('Starting geocoding for', reports.length, 'reports');

    for (const report of reports) {
      let lat, lng;
      let geocodedViaArcGIS = false;

      // Try ArcGIS geocoding if we have street/city data
      if (report.street && report.street.trim() !== '') {
        arcgisAttempts++;
        try {
          const result = await geocode({
            address: report.street,
            city: report.city || 'Hays',
            region: 'KS',
            authentication
          });

          if (result.candidates && result.candidates.length > 0) {
            lng = result.candidates[0].location.x;
            lat = result.candidates[0].location.y;
            geocodedViaArcGIS = true;
            geocodedCount++;
            console.log(`✓ Geocoded ${report.street}: ${lat}, ${lng}`);
          }
        } catch (error) {
          console.warn(`Failed to geocode ${report.street}:`, error.message);
        }
      }

      // Fallback to mock coordinates if ArcGIS didn't work
      if (!geocodedViaArcGIS) {
        // Create distribution around Hays, KS
        lat = HAYS_CENTER[0] + (Math.random() - 0.5) * 0.05;
        lng = HAYS_CENTER[1] + (Math.random() - 0.5) * 0.08;
      }

      // Add to geocoded array
      geocoded.push({
        ...report,
        lat,
        lng,
        geocodedViaArcGIS
      });

      // Add to heatmap if has OPRI
      if (report.opri && report.opri !== 'N/A') {
        heatPoints.push([lat, lng, report.opri]);
      }
    }

    console.log(`Geocoding complete: ${geocodedCount}/${arcgisAttempts} via ArcGIS, ${reports.length - geocodedCount} using fallback`);

    const stats = { total: reports.length, geocoded: geocodedCount };
    setMapData(geocoded);
    setHeatmapPoints(heatPoints);
    setGeoStats(stats);
    setIsGeocoding(false);

    // Save to cache
    if (id) {
      saveCachedData(id, geocoded, heatPoints, stats);
    }
  }, [saveCachedData]);

  useEffect(() => {
    if (!data || !data.inspectionReports) return;

    // Try to load from cache first
    if (dataId && loadCachedData(dataId)) {
      return; // Cache hit, no need to geocode
    }

    // Cache miss or no dataId, proceed with geocoding
    setIsGeocoding(true);
    setUsingCache(false);
    geocodeReports(data.inspectionReports, dataId);
  }, [data, dataId, geocodeReports, loadCachedData]);

  // Clear cache and re-geocode
  const clearCache = useCallback(() => {
    if (dataId) {
      const cacheKey = `geocoded_map_data_${dataId}`;
      localStorage.removeItem(cacheKey);
      console.log('✓ Cache cleared');
      setUsingCache(false);
      setIsGeocoding(true);
      geocodeReports(data.inspectionReports, dataId);
    }
  }, [dataId, data, geocodeReports]);

  const getConditionLabel = (opri) => {
    if (!opri || opri === 'N/A') return 'N/A';
    if (opri <= 1.5) return 'Excellent';
    if (opri <= 2.5) return 'Good';
    if (opri <= 3.5) return 'Fair';
    if (opri <= 4.5) return 'Poor';
    return 'Very Poor';
  };

  if (!data || !data.inspectionReports) {
    return (
      <div className="empty-state">
        <p>No inspection data available for mapping</p>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Map Controls */}
      <div style={{ 
        padding: '1rem', 
        background: '#f9fafb', 
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: '#111827' }}>
            OPRI Heatmap - Hays, Kansas
          </h3>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
            {geoStats.geocoded} of {geoStats.total} reports geocoded
            {isGeocoding && ' (geocoding...)'}
            {usingCache && ' (loaded from cache)'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showHeatmap}
              onChange={(e) => setShowHeatmap(e.target.checked)}
            />
            Show Heatmap
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showMarkers}
              onChange={(e) => setShowMarkers(e.target.checked)}
            />
            Show Markers
          </label>
          {usingCache && (
            <button
              onClick={clearCache}
              disabled={isGeocoding}
              style={{
                padding: '0.375rem 0.75rem',
                fontSize: '0.75rem',
                background: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: isGeocoding ? 'not-allowed' : 'pointer',
                color: '#374151',
                fontWeight: '500'
              }}
            >
              Refresh Geocoding
            </button>
          )}
        </div>
      </div>

      {/* Info Banner */}
      <div style={{
        padding: '0.75rem 1rem',
        background: geoStats.geocoded > 0 ? '#dcfce7' : '#eff6ff',
        borderBottom: geoStats.geocoded > 0 ? '1px solid #86efac' : '1px solid #bfdbfe',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '0.875rem',
        color: geoStats.geocoded > 0 ? '#166534' : '#1e40af'
      }}>
        <Info size={16} />
        <span>
          {geoStats.geocoded > 0 ? (
            <>
              <strong>✓ ArcGIS Active:</strong> {geoStats.geocoded} locations geocoded via ArcGIS. 
              {geoStats.geocoded < geoStats.total && ` ${geoStats.total - geoStats.geocoded} using fallback coordinates.`}
              {' '}Check browser console for details.
            </>
          ) : (
            <>
              <strong>Using Simulated Coordinates:</strong> No street data found for ArcGIS geocoding. 
              Reports need "Street" field populated. Check browser console for details.
            </>
          )}
        </span>
      </div>

      {/* Legend */}
      <div style={{
        padding: '0.75rem 1rem',
        background: 'white',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        gap: '2rem',
        fontSize: '0.875rem',
        flexWrap: 'wrap'
      }}>
        <div style={{ fontWeight: '600', color: '#374151' }}>OPRI Scale:</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'green' }}></div>
          Excellent (≤1.5)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'blue' }}></div>
          Good (1.6-2.5)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'yellow' }}></div>
          Fair (2.6-3.5)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'orange' }}></div>
          Poor (3.6-4.5)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'red' }}></div>
          Very Poor (&gt;4.5)
        </div>
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer
          center={HAYS_CENTER}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {/* Heatmap Layer */}
          {showHeatmap && <HeatmapLayer points={heatmapPoints} />}
          
          {/* Markers */}
          {showMarkers && mapData.map((report, idx) => (
            <Marker
              key={idx}
              position={[report.lat, report.lng]}
              icon={getMarkerIcon(report.opri)}
            >
              <Popup>
                <div style={{ minWidth: '200px' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: '600' }}>
                    PSR {report.psr}
                  </h4>
                  <div style={{ fontSize: '0.875rem', lineHeight: '1.5' }}>
                    <div><strong>Route:</strong> {report.upstreamMH} → {report.downstreamMH}</div>
                    {report.street && <div><strong>Street:</strong> {report.street}</div>}
                    {report.city && <div><strong>City:</strong> {report.city}</div>}
                    <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #e5e7eb' }}>
                      <strong>OPRI:</strong> 
                      <span style={{ 
                        marginLeft: '0.5rem',
                        padding: '0.125rem 0.5rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        background: report.opri <= 2.5 ? '#dcfce7' : report.opri <= 3.5 ? '#fef3c7' : '#fee2e2',
                        color: report.opri <= 2.5 ? '#166534' : report.opri <= 3.5 ? '#92400e' : '#991b1b'
                      }}>
                        {report.opri?.toFixed(1) || 'N/A'} - {getConditionLabel(report.opri)}
                      </span>
                    </div>
                    {report.pipeMaterial && <div><strong>Material:</strong> {report.pipeMaterial}</div>}
                    {report.pipeSize && <div><strong>Size:</strong> {report.pipeSize}</div>}
                    <div style={{ 
                      marginTop: '0.5rem', 
                      paddingTop: '0.5rem', 
                      borderTop: '1px solid #e5e7eb',
                      fontSize: '0.75rem',
                      color: '#6b7280'
                    }}>
                      {report.geocodedViaArcGIS ? (
                        <span style={{ color: '#166534' }}>✓ Geocoded via ArcGIS</span>
                      ) : (
                        <span>⚠ Using approximate location</span>
                      )}
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Integration Instructions */}
      <div style={{
        padding: '0.75rem 1rem',
        background: '#fffbeb',
        borderTop: '1px solid #fde68a',
        fontSize: '0.875rem',
        color: '#78350f'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
          <AlertCircle size={16} style={{ marginTop: '0.125rem', flexShrink: 0 }} />
          <div>
            <strong>To integrate real GIS data:</strong>
            <ol style={{ margin: '0.25rem 0 0 0', paddingLeft: '1.25rem' }}>
              <li>Export manhole coordinates from your GIS system (ArcGIS, QGIS, etc.)</li>
              <li>Add lat/lng fields to the PDF parser or upload a separate coordinate file</li>
              <li>Or use ArcGIS Geocoding API to convert street addresses to coordinates</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MapView;


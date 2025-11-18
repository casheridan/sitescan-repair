import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Search, Filter, X } from 'lucide-react';

function InspectionReportsTable({ data }) {
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [conditionFilter, setConditionFilter] = useState('all');
  const [materialFilter, setMaterialFilter] = useState('all');
  const [sortBy, setSortBy] = useState('psr');
  const [sortOrder, setSortOrder] = useState('asc');
  const [showFilters, setShowFilters] = useState(false);

  const toggleRow = (index) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  };

  const getOPRIClass = (opri) => {
    if (!opri) return '';
    if (opri <= 1.5) return 'opri-excellent';
    if (opri <= 2.5) return 'opri-good';
    if (opri <= 3.5) return 'opri-fair';
    if (opri <= 4.5) return 'opri-poor';
    return 'opri-very-poor';
  };

  const getConditionLabel = (opri) => {
    if (!opri) return 'N/A';
    if (opri <= 1.5) return 'Excellent';
    if (opri <= 2.5) return 'Good';
    if (opri <= 3.5) return 'Fair';
    if (opri <= 4.5) return 'Poor';
    return 'Very Poor';
  };

  // Get unique materials for filter dropdown
  const uniqueMaterials = useMemo(() => {
    if (!data) return [];
    const materials = [...new Set(data.map(r => r.pipeMaterial).filter(Boolean))];
    return materials.sort();
  }, [data]);

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    if (!data) return [];

    let filtered = data.filter(report => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
          report.psr?.toString().includes(searchLower) ||
          report.upstreamMH?.toLowerCase().includes(searchLower) ||
          report.downstreamMH?.toLowerCase().includes(searchLower) ||
          report.street?.toLowerCase().includes(searchLower) ||
          report.city?.toLowerCase().includes(searchLower);
        
        if (!matchesSearch) return false;
      }

      // Condition filter
      if (conditionFilter !== 'all') {
        const condition = getConditionLabel(report.opri);
        if (condition !== conditionFilter) return false;
      }

      // Material filter
      if (materialFilter !== 'all') {
        if (report.pipeMaterial !== materialFilter) return false;
      }

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let aVal, bVal;
      
      switch(sortBy) {
        case 'psr':
          aVal = parseInt(a.psr) || 0;
          bVal = parseInt(b.psr) || 0;
          break;
        case 'opri':
          aVal = a.opri || 999;
          bVal = b.opri || 999;
          break;
        case 'date':
          aVal = a.date ? new Date(a.date).getTime() : 0;
          bVal = b.date ? new Date(b.date).getTime() : 0;
          break;
        default:
          return 0;
      }

      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return filtered;
  }, [data, searchTerm, conditionFilter, materialFilter, sortBy, sortOrder]);

  const clearFilters = () => {
    setSearchTerm('');
    setConditionFilter('all');
    setMaterialFilter('all');
    setSortBy('psr');
    setSortOrder('asc');
  };

  const hasActiveFilters = searchTerm || conditionFilter !== 'all' || materialFilter !== 'all' || sortBy !== 'psr' || sortOrder !== 'asc';

  if (!data || data.length === 0) {
    return (
      <div className="empty-state">
        <p>No inspection reports available</p>
      </div>
    );
  }

  return (
    <div>
      {/* Search and Filters Bar */}
      <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
        {/* Search Bar */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: showFilters ? '1rem' : 0 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input
              type="text"
              placeholder="Search by PSR, MH ID, street, or city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem 0.5rem 2.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '0.875rem'
              }}
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              background: showFilters ? '#3b82f6' : 'white',
              color: showFilters ? 'white' : '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500'
            }}
          >
            <Filter size={16} />
            Filters
          </button>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                background: 'white',
                color: '#dc2626',
                border: '1px solid #dc2626',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
            >
              <X size={16} />
              Clear
            </button>
          )}
        </div>

        {/* Filters */}
        {showFilters && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
            {/* Condition Filter */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.25rem' }}>
                Condition
              </label>
              <select
                value={conditionFilter}
                onChange={(e) => setConditionFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  background: 'white'
                }}
              >
                <option value="all">All Conditions</option>
                <option value="Excellent">Excellent (≤1.5)</option>
                <option value="Good">Good (1.6-2.5)</option>
                <option value="Fair">Fair (2.6-3.5)</option>
                <option value="Poor">Poor (3.6-4.5)</option>
                <option value="Very Poor">Very Poor (>4.5)</option>
                <option value="N/A">N/A (No OPRI)</option>
              </select>
            </div>

            {/* Material Filter */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.25rem' }}>
                Pipe Material
              </label>
              <select
                value={materialFilter}
                onChange={(e) => setMaterialFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  background: 'white'
                }}
              >
                <option value="all">All Materials</option>
                {uniqueMaterials.map(material => (
                  <option key={material} value={material}>{material}</option>
                ))}
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.25rem' }}>
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  background: 'white'
                }}
              >
                <option value="psr">PSR Number</option>
                <option value="opri">OPRI Rating</option>
                <option value="date">Date</option>
              </select>
            </div>

            {/* Sort Order */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.25rem' }}>
                Order
              </label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  background: 'white'
                }}
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
          </div>
        )}

        {/* Results Count */}
        <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
          Showing {filteredAndSortedData.length} of {data.length} reports
        </div>
      </div>

      {/* Reports List */}
      {filteredAndSortedData.length === 0 ? (
        <div className="empty-state">
          <p>No inspection reports match your filters</p>
          <button onClick={clearFilters} style={{ marginTop: '0.5rem', padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
            Clear Filters
          </button>
        </div>
      ) : (
        filteredAndSortedData.map((report, index) => (
        <div key={index} style={{ marginBottom: '1rem', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
          <div 
            style={{ 
              padding: '1rem',
              background: '#f9fafb',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem'
            }}
            onClick={() => toggleRow(index)}
          >
            {expandedRows.has(index) ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>PSR</div>
                <div style={{ fontSize: '1.125rem', fontWeight: '600' }}>{report.psr || 'N/A'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Date</div>
                <div style={{ fontSize: '1rem' }}>{report.date || 'N/A'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Route</div>
                <div style={{ fontSize: '0.875rem' }}>{report.upstreamMH} → {report.downstreamMH}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>OPRI</div>
                <div>
                  <span className={`opri-badge ${getOPRIClass(report.opri)}`}>
                    {report.opri?.toFixed(1) || 'N/A'} - {getConditionLabel(report.opri)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {expandedRows.has(index) && (
            <div style={{ padding: '1.5rem', background: 'white' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                
                {/* Location */}
                <div>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                    Location
                  </h4>
                  {report.city && <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>City: {report.city}</p>}
                  {report.street && <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Street: {report.street}</p>}
                </div>

                {/* Pipe Details */}
                <div>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                    Pipe Details
                  </h4>
                  {report.pipeShape && <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Shape: {report.pipeShape}</p>}
                  {report.pipeSize && <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Size: {report.pipeSize}</p>}
                  {report.pipeMaterial && <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Material: {report.pipeMaterial}</p>}
                </div>

                {/* Survey Info */}
                <div>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                    Survey Info
                  </h4>
                  {report.surveyedBy && <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Surveyed By: {report.surveyedBy}</p>}
                  {report.certificateNumber && <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Certificate: {report.certificateNumber}</p>}
                  {report.pipeCleaning && <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Pre-Cleaning: {report.pipeCleaning}</p>}
                  {report.direction && <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Direction: {report.direction}</p>}
                </div>

                {/* Performance Ratings */}
                <div>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                    Performance Ratings
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem', fontSize: '0.875rem' }}>
                    {report.qsr !== undefined && <><span style={{ color: '#6b7280' }}>QSR:</span> <span>{report.qsr}</span></>}
                    {report.qmr !== undefined && <><span style={{ color: '#6b7280' }}>QMR:</span> <span>{report.qmr}</span></>}
                    {report.qor !== undefined && <><span style={{ color: '#6b7280' }}>QOR:</span> <span>{report.qor}</span></>}
                    {report.spr !== undefined && <><span style={{ color: '#6b7280' }}>SPR:</span> <span>{report.spr}</span></>}
                    {report.mpr !== undefined && <><span style={{ color: '#6b7280' }}>MPR:</span> <span>{report.mpr}</span></>}
                    {report.opr !== undefined && <><span style={{ color: '#6b7280' }}>OPR:</span> <span>{report.opr}</span></>}
                  </div>
                </div>

                {/* Rating Indices */}
                <div>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                    Rating Indices
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem', fontSize: '0.875rem' }}>
                    {report.spri !== undefined && <><span style={{ color: '#6b7280' }}>SPRI:</span> <span>{report.spri}</span></>}
                    {report.mpri !== undefined && <><span style={{ color: '#6b7280' }}>MPRI:</span> <span>{report.mpri}</span></>}
                    {report.opri !== undefined && <><span style={{ color: '#6b7280' }}>OPRI:</span> <span><strong>{report.opri}</strong></span></>}
                  </div>
                </div>

                {/* Length & Joints */}
                <div>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                    Length & Joints
                  </h4>
                  {report.totalLength !== undefined && <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Total Length: {report.totalLength} ft</p>}
                  {report.lengthSurveyed !== undefined && <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Length Surveyed: {report.lengthSurveyed} ft</p>}
                  {report.jointsPassed !== undefined && <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Joints Passed: {report.jointsPassed}</p>}
                  {report.jointsFailed !== undefined && <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Joints Failed: {report.jointsFailed}</p>}
                  {report.totalGallonsUsed !== undefined && <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Gallons Used: {report.totalGallonsUsed}</p>}
                </div>
              </div>

              {/* Observations */}
              {report.observations && report.observations.length > 0 && (
                <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e5e7eb' }}>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.75rem' }}>
                    Observations ({report.observations.length})
                  </h4>
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {report.observations.map((obs, obsIndex) => (
                      <div key={obsIndex} style={{ padding: '0.75rem', background: '#f9fafb', borderRadius: '6px', fontSize: '0.875rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.25rem' }}>
                          <span className="code-badge">{obs.code}</span>
                          <span style={{ color: '#6b7280' }}>@ {obs.distance} ft</span>
                          <span style={{ color: '#9ca3af', marginLeft: 'auto' }}>{obs.counter}</span>
                        </div>
                        <div style={{ color: '#4b5563' }}>{obs.observation}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )))}
    </div>
  );
}

export default InspectionReportsTable;

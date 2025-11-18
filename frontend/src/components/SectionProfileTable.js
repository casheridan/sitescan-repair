import React, { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

function SectionProfileTable({ data }) {
  const [sortField, setSortField] = useState('psr');
  const [sortDirection, setSortDirection] = useState('asc');

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];

    // Handle numeric sorting
    if (sortField === 'totalLength' || sortField === 'lengthSurveyed' || sortField === 'psr') {
      aVal = parseFloat(aVal) || 0;
      bVal = parseFloat(bVal) || 0;
    }

    if (sortDirection === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  if (!data || data.length === 0) {
    return (
      <div className="empty-state">
        <p>No section profile data available</p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th onClick={() => handleSort('no')} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                No <SortIcon field="no" />
              </div>
            </th>
            <th onClick={() => handleSort('psr')} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                PSR <SortIcon field="psr" />
              </div>
            </th>
            <th>Upstream MH</th>
            <th>Downstream MH</th>
            <th onClick={() => handleSort('date')} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                Date <SortIcon field="date" />
              </div>
            </th>
            <th onClick={() => handleSort('material')} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                Material <SortIcon field="material" />
              </div>
            </th>
            <th onClick={() => handleSort('totalLength')} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                Total Length (ft) <SortIcon field="totalLength" />
              </div>
            </th>
            <th onClick={() => handleSort('lengthSurveyed')} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                Length Surveyed (ft) <SortIcon field="lengthSurveyed" />
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedData.map((item, index) => (
            <tr key={index}>
              <td>{item.no}</td>
              <td><strong>{item.psr}</strong></td>
              <td>{item.upstreamMH}</td>
              <td>{item.downstreamMH}</td>
              <td>{item.date}</td>
              <td>
                <span className="code-badge">{item.material}</span>
              </td>
              <td>{item.totalLength.toFixed(1)}</td>
              <td>{item.lengthSurveyed.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ padding: '1rem', textAlign: 'center', color: '#6b7280', fontSize: '0.875rem' }}>
        Showing {sortedData.length} entries
      </div>
    </div>
  );
}

export default SectionProfileTable;

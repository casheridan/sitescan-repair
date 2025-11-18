import React, { useState } from 'react';
import { Filter } from 'lucide-react';

function ObservationsTable({ data }) {
  const [filterCode, setFilterCode] = useState('');

  // Extract all observations from inspection reports
  const allObservations = [];
  data.forEach(report => {
    if (report.observations) {
      report.observations.forEach(obs => {
        allObservations.push({
          ...obs,
          psr: report.psr,
          upstreamMH: report.upstreamMH,
          downstreamMH: report.downstreamMH,
          date: report.date
        });
      });
    }
  });

  // Get unique observation codes
  const uniqueCodes = [...new Set(allObservations.map(obs => obs.code))].sort();

  // Filter observations
  const filteredObservations = filterCode
    ? allObservations.filter(obs => obs.code === filterCode)
    : allObservations;

  // Sort by distance
  const sortedObservations = [...filteredObservations].sort((a, b) => {
    if (a.psr === b.psr) {
      return a.distance - b.distance;
    }
    return a.psr.localeCompare(b.psr);
  });

  if (allObservations.length === 0) {
    return (
      <div className="empty-state">
        <p>No observations available</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <Filter size={18} style={{ color: '#6b7280' }} />
        <select
          value={filterCode}
          onChange={(e) => setFilterCode(e.target.value)}
          style={{
            padding: '0.5rem 1rem',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            fontSize: '0.875rem',
            cursor: 'pointer'
          }}
        >
          <option value="">All Codes ({allObservations.length})</option>
          {uniqueCodes.map(code => {
            const count = allObservations.filter(obs => obs.code === code).length;
            return (
              <option key={code} value={code}>
                {code} ({count})
              </option>
            );
          })}
        </select>
        <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>
          Showing {sortedObservations.length} of {allObservations.length} observations
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>PSR</th>
              <th>Date</th>
              <th>Route</th>
              <th>Distance (ft)</th>
              <th>Code</th>
              <th>Observation</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {sortedObservations.map((obs, index) => (
              <tr key={index}>
                <td><strong>{obs.psr}</strong></td>
                <td>{obs.date}</td>
                <td style={{ fontSize: '0.75rem' }}>
                  {obs.upstreamMH} → {obs.downstreamMH}
                </td>
                <td>{obs.distance.toFixed(1)}</td>
                <td>
                  <span className="code-badge">{obs.code}</span>
                </td>
                <td style={{ maxWidth: '400px' }}>{obs.observation}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                  {obs.counter}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f9fafb', borderRadius: '8px' }}>
        <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.75rem' }}>
          Observation Code Summary
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.5rem' }}>
          {uniqueCodes.map(code => {
            const count = allObservations.filter(obs => obs.code === code).length;
            return (
              <div key={code} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: 'white', borderRadius: '4px' }}>
                <span className="code-badge">{code}</span>
                <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default ObservationsTable;

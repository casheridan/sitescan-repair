import React from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#667eea', '#764ba2', '#f093fb', '#4facfe'];

function Dashboard({ data }) {
  const stats = data.statistics;

  // Prepare material data for pie chart
  const materialData = Object.entries(stats.materials).map(([name, value]) => ({
    name,
    value
  }));

  // Prepare OPRI data for bar chart
  const opriData = stats.opriScores.map(score => ({
    psr: `PSR ${score.psr}`,
    opri: score.opri,
    condition: score.condition
  }));

  const getOPRIColor = (opri) => {
    if (opri <= 1.5) return '#10b981';
    if (opri <= 2.5) return '#3b82f6';
    if (opri <= 3.5) return '#f59e0b';
    if (opri <= 4.5) return '#ef4444';
    return '#dc2626';
  };

  return (
    <div className="dashboard">
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total PSR Entries</h3>
          <div className="value">{stats.totalPSREntries}</div>
          <div className="label">Pipe Segments</div>
        </div>
        
        <div className="stat-card">
          <h3>Total Length</h3>
          <div className="value">{(stats.totalLength / 5280).toFixed(1)}</div>
          <div className="label">Miles ({stats.totalLength.toFixed(0)} feet)</div>
        </div>
        
        <div className="stat-card">
          <h3>Inspection Reports</h3>
          <div className="value">{stats.totalInspectionReports}</div>
          <div className="label">Detailed Assessments</div>
        </div>
        
        <div className="stat-card">
          <h3>Average Length</h3>
          <div className="value">{stats.averageLength.toFixed(0)}</div>
          <div className="label">Feet per Segment</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="chart-container">
          <h3>Pipe Materials</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={materialData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {materialData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {opriData.length > 0 && (
          <div className="chart-container">
            <h3>OPRI Scores</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={opriData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="psr" />
                <YAxis domain={[0, 5]} />
                <Tooltip />
                <Bar dataKey="opri" fill="#667eea">
                  {opriData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getOPRIColor(entry.opri)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="chart-container">
        <h3>Segment Details</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          <div style={{ padding: '1rem', background: '#f9fafb', borderRadius: '8px' }}>
            <h4 style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>Longest Segment</h4>
            <p style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937' }}>
              PSR {stats.longestSegment?.psr}
            </p>
            <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              {stats.longestSegment?.totalLength.toFixed(1)} feet
            </p>
            <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
              {stats.longestSegment?.upstreamMH} → {stats.longestSegment?.downstreamMH}
            </p>
          </div>

          <div style={{ padding: '1rem', background: '#f9fafb', borderRadius: '8px' }}>
            <h4 style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>Shortest Segment</h4>
            <p style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937' }}>
              PSR {stats.shortestSegment?.psr}
            </p>
            <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              {stats.shortestSegment?.totalLength.toFixed(1)} feet
            </p>
            <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
              {stats.shortestSegment?.upstreamMH} → {stats.shortestSegment?.downstreamMH}
            </p>
          </div>

          <div style={{ padding: '1rem', background: '#f9fafb', borderRadius: '8px' }}>
            <h4 style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>Date Range</h4>
            <p style={{ fontSize: '0.875rem', color: '#1f2937', fontWeight: '500' }}>
              {stats.dateRange.earliest}
            </p>
            <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>to</p>
            <p style={{ fontSize: '0.875rem', color: '#1f2937', fontWeight: '500' }}>
              {stats.dateRange.latest}
            </p>
          </div>

          {Object.keys(stats.observationCodes).length > 0 && (
            <div style={{ padding: '1rem', background: '#f9fafb', borderRadius: '8px' }}>
              <h4 style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                Top Observations
              </h4>
              {Object.entries(stats.observationCodes)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([code, count]) => (
                  <div key={code} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span className="code-badge">{code}</span>
                    <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>{count}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;

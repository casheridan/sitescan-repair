import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FolderOpen, Trash2, RefreshCw, FileText, Calendar, HardDrive } from 'lucide-react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

function Projects({ onLoadProject }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadingProject, setLoadingProject] = useState(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${API_BASE}/projects`, {
        withCredentials: true
      });
      setProjects(response.data.projects || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadProject = async (projectId) => {
    try {
      setLoadingProject(projectId);
      const response = await axios.get(`${API_BASE}/projects/${projectId}/data`, {
        withCredentials: true
      });
      
      if (response.data.success) {
        onLoadProject(response.data.data);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to load project data');
    } finally {
      setLoadingProject(null);
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (!window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }

    try {
      await axios.delete(`${API_BASE}/projects/${projectId}`, {
        withCredentials: true
      });
      setProjects(projects.filter(p => p.id !== projectId));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete project');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${mb.toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner"></div>
        <p>Loading projects...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state">
        <p style={{ color: '#dc2626' }}>{error}</p>
        <button onClick={fetchProjects} className="btn btn-primary" style={{ marginTop: '1rem' }}>
          <RefreshCw size={18} />
          Retry
        </button>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="empty-state">
        <FolderOpen size={64} style={{ color: '#9ca3af', marginBottom: '1rem' }} />
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>No Projects Yet</h3>
        <p style={{ color: '#6b7280' }}>Upload a PDF to create your first project</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '1.5rem',
        padding: '1rem',
        background: '#f9fafb',
        borderRadius: '8px'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>My Projects</h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
            {projects.length} project{projects.length !== 1 ? 's' : ''} saved
          </p>
        </div>
        <button onClick={fetchProjects} className="btn btn-secondary">
          <RefreshCw size={18} />
          Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gap: '1rem' }}>
        {projects.map((project) => (
          <div 
            key={project.id}
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '1.5rem',
              background: 'white',
              transition: 'box-shadow 0.2s',
              cursor: project.has_data ? 'pointer' : 'default'
            }}
            onMouseEnter={(e) => {
              if (project.has_data) {
                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
            onClick={() => {
              if (project.has_data && !loadingProject) {
                handleLoadProject(project.id);
              }
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <FileText size={24} style={{ color: '#3b82f6', flexShrink: 0 }} />
                  <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', wordBreak: 'break-word' }}>
                    {project.filename}
                  </h3>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Calendar size={16} />
                    <span>{formatDate(project.upload_date)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <HardDrive size={16} />
                    <span>{formatFileSize(project.file_size)}</span>
                  </div>
                </div>

                {project.has_data ? (
                  <div style={{
                    marginTop: '0.75rem',
                    padding: '0.5rem 0.75rem',
                    background: '#dcfce7',
                    color: '#166534',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    display: 'inline-block'
                  }}>
                    ✓ Parsed & Ready
                  </div>
                ) : (
                  <div style={{
                    marginTop: '0.75rem',
                    padding: '0.5rem 0.75rem',
                    background: '#fef3c7',
                    color: '#92400e',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    display: 'inline-block'
                  }}>
                    Not Parsed Yet
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                {project.has_data && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLoadProject(project.id);
                    }}
                    disabled={loadingProject === project.id}
                    className="btn btn-primary"
                    style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                  >
                    {loadingProject === project.id ? (
                      <>
                        <RefreshCw size={16} className="spinning" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <FolderOpen size={16} />
                        Load
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteProject(project.id);
                  }}
                  className="btn btn-secondary"
                  style={{ 
                    fontSize: '0.875rem', 
                    padding: '0.5rem 1rem',
                    color: '#dc2626',
                    borderColor: '#dc2626'
                  }}
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Projects;


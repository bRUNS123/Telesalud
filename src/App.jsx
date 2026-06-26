import { useState, useEffect } from 'react';
import { citasDB } from './firebase';
import { Search, Activity, Stethoscope, HeartPulse, User, MapPin, Calendar, FileText, AlertCircle, RefreshCw, PenLine, CircleDot, CheckCircle2, Bell, Plus, X, Clock, Trash2 } from 'lucide-react';

const PRECONFIGURED_REQUESTS = [
  { code: 'B8A6F25C92', area: 'Dental (Reingreso)', icon: User },
  { code: 'B3D6EDB6E2', area: 'Nutrición', icon: Activity },
  { code: 'BD87AAA1E7', area: 'Dental', icon: User },
  { code: '4AF30887DD', area: 'Psicología', icon: HeartPulse },
  { code: '6768596FA3', area: 'Medicina', icon: Stethoscope }
];

const EMPTY_CITA = { area: '', fecha: '', hora: '', centro: '', nota: '' };

function App() {
  const [codigo, setCodigo] = useState('');
  const [apellido, setApellido] = useState('Franco');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);
  const [citasManuales, setCitasManuales] = useState([]);
  const [showCitaForm, setShowCitaForm] = useState(false);
  const [nuevaCita, setNuevaCita] = useState(EMPTY_CITA);
  const [firebaseActivo, setFirebaseActivo] = useState(false);

  useEffect(() => { fetchAllPreconfigured(); }, []);

  // Suscripción en tiempo real a Firestore (o localStorage como fallback)
  useEffect(() => {
    setFirebaseActivo(citasDB.isActive());
    const unsub = citasDB.subscribe((citas) => {
      setCitasManuales(citas);
    });
    return () => unsub && unsub();
  }, []);

  const guardarCita = async () => {
    if (!nuevaCita.area || !nuevaCita.fecha) return;
    await citasDB.add(nuevaCita);
    setNuevaCita(EMPTY_CITA);
    setShowCitaForm(false);
  };

  const eliminarCita = async (id) => {
    await citasDB.delete(id);
  };

  const fetchAllPreconfigured = async () => {
    setLoading(true);
    setError(null);
    try {
      const promises = PRECONFIGURED_REQUESTS.map(req => 
        fetchRequestData(req.code, 'Franco')
      );
      const responses = await Promise.all(promises);
      const validResults = responses.filter(r => r !== null);
      setResults(validResults);
    } catch (err) {
      setError('Error al cargar las solicitudes preconfiguradas.');
    } finally {
      setLoading(false);
    }
  };

  const fetchRequestData = async (trackingCode, familyName) => {
    try {
      const response = await fetch(`https://api.telesalud.gob.cl/api/v1/care-requests/tracking?patient.family=${encodeURIComponent(familyName)}&trackingCode=${encodeURIComponent(trackingCode)}`);
      if (!response.ok) {
        if(response.status === 404) return null;
        throw new Error('Error en el servidor');
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(error);
      return null;
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!codigo || !apellido) return;

    setLoading(true);
    setError(null);
    try {
      const data = await fetchRequestData(codigo, apellido);
      if (data) {
        // Add to results, preventing duplicates
        setResults(prev => {
          const exists = prev.find(p => p.trackingCode === data.trackingCode);
          if (exists) {
            return prev.map(p => p.trackingCode === data.trackingCode ? data : p);
          }
          return [data, ...prev];
        });
        setCodigo(''); // Clear input after success
      } else {
        setError('No se encontró ninguna solicitud con ese código y apellido.');
      }
    } catch (err) {
      setError('Ocurrió un error al intentar conectar con Telesalud.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return 'No disponible';
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('es-CL', { 
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>Telesalud Dashboard</h1>
        <p>Seguimiento centralizado de tus solicitudes médicas</p>
        {firebaseActivo && (
          <span className="firebase-badge">🔥 Sincronizado en la nube</span>
        )}
      </header>

      {error && (
        <div className="error-message">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      <form className="search-form glass-panel" onSubmit={handleSearch}>
        <div className="input-group">
          <label htmlFor="codigo">Código de Seguimiento</label>
          <input 
            type="text" 
            id="codigo"
            className="input-field" 
            placeholder="Ej: B3D6EDB6E2"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          />
        </div>
        <div className="input-group">
          <label htmlFor="apellido">Primer Apellido</label>
          <input 
            type="text" 
            id="apellido"
            className="input-field" 
            placeholder="Ej: Franco"
            value={apellido}
            onChange={(e) => setApellido(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary" disabled={loading || !codigo || !apellido}>
          {loading ? <div className="loading-spinner"></div> : <Search size={20} />}
          <span>Consultar</span>
        </button>
      </form>

      <div className="citas-manuales-section">
        <div className="section-header">
          <h3>Citas Agendadas</h3>
          <button className="btn-add-cita" onClick={() => setShowCitaForm(v => !v)}>
            {showCitaForm ? <X size={16} /> : <Plus size={16} />}
            {showCitaForm ? 'Cancelar' : 'Agregar Cita'}
          </button>
        </div>

        {showCitaForm && (
          <div className="cita-form glass-panel">
            <div className="cita-form-grid">
              <div className="input-group">
                <label>Especialidad / Área *</label>
                <input className="input-field" placeholder="Ej: Dental, Medicina..." value={nuevaCita.area} onChange={e => setNuevaCita(p => ({ ...p, area: e.target.value }))} />
              </div>
              <div className="input-group">
                <label>Centro de Salud</label>
                <input className="input-field" placeholder="Ej: CESFAM Lo Barnechea" value={nuevaCita.centro} onChange={e => setNuevaCita(p => ({ ...p, centro: e.target.value }))} />
              </div>
              <div className="input-group">
                <label>Fecha *</label>
                <input className="input-field" type="date" value={nuevaCita.fecha} onChange={e => setNuevaCita(p => ({ ...p, fecha: e.target.value }))} />
              </div>
              <div className="input-group">
                <label>Hora</label>
                <input className="input-field" type="time" value={nuevaCita.hora} onChange={e => setNuevaCita(p => ({ ...p, hora: e.target.value }))} />
              </div>
              <div className="input-group cita-form-full">
                <label>Nota / Observación</label>
                <input className="input-field" placeholder="Información adicional..." value={nuevaCita.nota} onChange={e => setNuevaCita(p => ({ ...p, nota: e.target.value }))} />
              </div>
            </div>
            <button className="btn-primary" style={{ marginTop: '1rem' }} onClick={guardarCita} disabled={!nuevaCita.area || !nuevaCita.fecha}>
              <Plus size={18} /> Guardar Cita
            </button>
          </div>
        )}

        {citasManuales.length > 0 && (
          <div className="results-grid" style={{ marginTop: '1rem' }}>
            {citasManuales.map(cita => (
              <div key={cita.id} className="status-card glass-panel cita-manual-card">
                <div className="card-header">
                  <h2 className="card-title">
                    <Calendar size={24} color="var(--accent)" />
                    {cita.area}
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="status-badge manual">Manual</span>
                    <button className="btn-icon-danger" onClick={() => eliminarCita(cita.id)} title="Eliminar cita">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <div className="card-body">
                  <div className="info-row">
                    <Calendar size={18} className="info-icon" />
                    <div className="info-content">
                      <span className="info-label">Fecha</span>
                      <span className="info-value">
                        {new Date(cita.fecha + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}
                        {cita.hora && <> &nbsp;·&nbsp; <Clock size={13} style={{ display: 'inline', verticalAlign: 'middle' }} /> {cita.hora}</>}
                      </span>
                    </div>
                  </div>
                  {cita.centro && (
                    <div className="info-row">
                      <MapPin size={18} className="info-icon" />
                      <div className="info-content">
                        <span className="info-label">Centro de Salud</span>
                        <span className="info-value">{cita.centro}</span>
                      </div>
                    </div>
                  )}
                  {cita.nota && (
                    <div className="info-row">
                      <FileText size={18} className="info-icon" />
                      <div className="info-content">
                        <span className="info-label">Nota</span>
                        <span className="info-value">{cita.nota}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="quick-actions">
        <h3>Tus Consultas Recientes</h3>
        <div className="tags-container">
          {PRECONFIGURED_REQUESTS.map((req, idx) => {
            const Icon = req.icon;
            return (
              <button key={idx} className="tag-btn" onClick={() => { setCodigo(req.code); setApellido('Franco'); }}>
                <Icon size={16} />
                {req.area} ({req.code})
              </button>
            )
          })}
          <button className="tag-btn" onClick={fetchAllPreconfigured} style={{background: 'rgba(59, 130, 246, 0.2)'}}>
            <RefreshCw size={16} className={loading ? "spin" : ""} /> Actualizar Todo
          </button>
        </div>
      </div>

      <div className="results-grid">
        {results.map((result) => {
          const statusLower = result.careRequestStatus?.code?.toLowerCase() || '';
          const isClosed = statusLower === 'closed';
          
          return (
            <div key={result.trackingCode} className="status-card glass-panel">
              <div className="card-header">
                <h2 className="card-title">
                  <Activity size={24} color="var(--primary)" />
                  {result.careDetail?.careType?.careArea?.display || 'Consulta'}
                </h2>
                <span className={`status-badge ${isClosed ? 'cerrada' : 'abierta'}`}>
                  {result.careRequestStatus?.display || 'Desconocido'}
                </span>
              </div>
              
              <div className="stepper-container">
                <div className="stepper-line"></div>
                <div className="stepper-line-progress" style={{ width: `${isClosed ? 100 : 50}%` }}></div>
                
                <div className={`stepper-step completed`}>
                  <div className="stepper-icon"><PenLine size={16} /></div>
                  <span className="stepper-label">Solicitud ingresada</span>
                </div>
                
                <div className={`stepper-step ${isClosed ? 'completed' : 'active'}`}>
                  <div className="stepper-icon"><CircleDot size={16} /></div>
                  <span className="stepper-label">Solicitud en revision</span>
                </div>
                
                <div className={`stepper-step ${isClosed ? 'completed' : ''}`}>
                  <div className="stepper-icon"><CheckCircle2 size={16} /></div>
                  <span className="stepper-label">Solicitud finalizada</span>
                </div>
              </div>

              {!isClosed && (
                <div className="status-message">
                  <strong>Hola {result.patient?.given?.split(' ')[0] || 'Paciente'} {result.patient?.family || ''},</strong>
                  Tu solicitud ha sido categorizada por el Centro de salud. Es posible que nos contactemos contigo al número de teléfono registrado.
                </div>
              )}

              <div className="card-body" style={{ marginTop: '1.5rem' }}>
                <div className="info-row">
                  <User size={18} className="info-icon" />
                  <div className="info-content">
                    <span className="info-label">Paciente</span>
                    <span className="info-value">{result.patient?.fullName || 'No disponible'}</span>
                  </div>
                </div>

                <div className="info-row">
                  <MapPin size={18} className="info-icon" />
                  <div className="info-content">
                    <span className="info-label">Centro de Salud</span>
                    <span className="info-value">{result.organization?.display || 'No disponible'}</span>
                  </div>
                </div>

                <div className="info-row">
                  <Calendar size={18} className="info-icon" />
                  <div className="info-content">
                    <span className="info-label">Actualizado</span>
                    <span className="info-value">{formatDate(result.updatedAt)}</span>
                  </div>
                </div>

                <div className="info-row">
                  <FileText size={18} className="info-icon" />
                  <div className="info-content">
                    <span className="info-label">Motivo original</span>
                    <span className="info-value">{result.supportingInfo || result.careDetail?.display}</span>
                  </div>
                </div>

                {result.careRequestClosure?.note && (() => {
                  const note = result.careRequestClosure.note;
                  const isReminder = note.toLowerCase().includes('hora') || note.toLowerCase().includes('cita') || note.toLowerCase().includes('empa');
                  
                  if (isReminder) {
                    return (
                      <div className="reminder-box">
                        <div className="reminder-icon">
                          <Bell size={24} />
                        </div>
                        <div className="reminder-content">
                          <strong>¡Tienes una cita programada!</strong>
                          {note.split('\n').map((line, i) => (
                            <p key={i} style={{marginBottom: line.trim() ? '0.25rem' : '0'}}>{line}</p>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="info-row" style={{flexDirection: 'column', marginTop: '0.5rem'}}>
                      <span className="info-label">Resolución / Nota del Centro:</span>
                      <div className="note-box">
                        {note.split('\n').map((line, i) => (
                          <p key={i} style={{marginBottom: line.trim() ? '0.5rem' : '0'}}>{line}</p>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}

export default App;

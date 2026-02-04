import React, { useState } from 'react';
import Card from 'react-bootstrap/Card';
import Badge from 'react-bootstrap/Badge';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import Form from 'react-bootstrap/Form';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';
import axios from 'axios';

function BusSearch() {
  // User input
  const [vehicleId, setVehicleId] = useState('');

  // API result
  const [vehicle, setVehicle] = useState(null);

  // Loading + error handling
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function fetchVehicle(e) {
    e.preventDefault();

    const id = vehicleId.trim();
    if (!id) return;

    try {
      setLoading(true);
      setError('');
      setVehicle(null);

      // MBTA: fetch a single vehicle by id
      const res = await axios.get(
        `https://api-v3.mbta.com/vehicles/${encodeURIComponent(id)}`
      );

      setVehicle(res.data?.data || null);
    } catch (err) {
      const message =
        err?.response?.data?.errors?.[0]?.detail ||
        err?.message ||
        'Something went wrong while fetching that vehicle.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  // ===== Styling (matches your Alerts vibe) =====
  const pageStyle = {
    minHeight: '100vh',
    backgroundColor: '#1d96ff',
    paddingTop: '24px',
    paddingBottom: '24px',
  };

  const cardStyle = {
    borderRadius: '14px',
    backgroundColor: '#000000',
    borderColor: 'rgba(255,255,255,0.10)',
  };

  const titleStyle = {
    color: '#ffd166',
    fontSize: '1rem',
    fontWeight: 700,
  };

  const metaStyle = {
    color: 'rgba(255,255,255,0.70)',
    fontSize: '0.85rem',
  };

  function badgeForOccupancy(occ) {
    if (!occ) return <Badge bg="secondary">No occupancy data</Badge>;

    const upper = String(occ).toUpperCase();

    if (upper.includes('EMPTY')) return <Badge bg="success">Empty</Badge>;
    if (upper.includes('MANY_SEATS')) return <Badge bg="success">Many seats</Badge>;
    if (upper.includes('FEW_SEATS')) return <Badge bg="warning">Few seats</Badge>;
    if (upper.includes('STANDING_ROOM_ONLY')) return <Badge bg="warning">Standing room</Badge>;
    if (upper.includes('CRUSHED')) return <Badge bg="danger">Very crowded</Badge>;
    if (upper.includes('FULL')) return <Badge bg="danger">Full</Badge>;
    if (upper.includes('NOT_ACCEPTING')) return <Badge bg="dark">Not accepting</Badge>;

    return <Badge bg="info">{occ}</Badge>;
  }

  function badgeForCurrentStatus(status) {
    if (!status) return <Badge bg="secondary">Unknown status</Badge>;

    const upper = String(status).toUpperCase();

    if (upper.includes('STOPPED')) return <Badge bg="warning">Stopped</Badge>;
    if (upper.includes('INCOMING')) return <Badge bg="info">Incoming</Badge>;
    if (upper.includes('IN_TRANSIT')) return <Badge bg="primary">In transit</Badge>;

    return <Badge bg="info">{status}</Badge>;
  }

  // ===== Safely extract fields OUTSIDE JSX (prevents compile issues) =====
  const a = vehicle?.attributes || {};
  const r = vehicle?.relationships || {};

  const occupancy = a.occupancy_status;
  const status = a.current_status;

  const borderVariant =
    typeof a.severity === 'number'
      ? a.severity >= 7
        ? 'danger'
        : a.severity >= 4
        ? 'warning'
        : 'primary'
      : 'primary';

  return (
    <div style={pageStyle}>
      <Container>
        <Row className="align-items-end mb-3">
          <Col xs={12} md={6}>
            <h1 className="mb-1 text-light" style={{ fontSize: '1.6rem' }}>
              Vehicle Search
            </h1>
            <div className="text-muted">
              Enter a vehicle id to see occupancy and current status.
            </div>
          </Col>

          <Col xs={12} md={6} className="mt-3 mt-md-0">
            <Form onSubmit={fetchVehicle} className="d-flex gap-2">
              <Form.Control
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                placeholder="Enter vehicle id..."
              />
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Spinner size="sm" animation="border" className="me-2" />
                    Loading
                  </>
                ) : (
                  'Search'
                )}
              </Button>
            </Form>
          </Col>
        </Row>

        {!loading && error ? (
          <Alert variant="danger" className="mt-3">
            {error}
          </Alert>
        ) : null}

        {loading ? (
          <div className="d-flex align-items-center gap-2 text-light mt-3">
            <Spinner animation="border" role="status" />
            <div>Fetching vehicle data…</div>
          </div>
        ) : null}

        {!loading && vehicle ? (
          <Row className="mt-2 g-3">
            <Col xs={12} md={8} lg={6} className="d-flex">
              <Card border={borderVariant} className="shadow-sm h-100 w-100" style={cardStyle}>
                <Card.Body className="p-3">
                  <div className="d-flex justify-content-between align-items-start gap-2">
                    <div>
                      <div style={titleStyle}>Vehicle ID: {vehicle.id}</div>
                      <div style={metaStyle}>Label: {a.label || 'N/A'}</div>
                    </div>

                    <div className="d-flex flex-column align-items-end gap-1">
                      {badgeForCurrentStatus(status)}
                      {badgeForOccupancy(occupancy)}
                    </div>
                  </div>

                  <hr style={{ borderColor: 'rgba(255,255,255,0.12)' }} />

                  <div style={{ color: 'rgba(255,255,255,0.88)' }}>
                    <div className="d-flex justify-content-between">
                      <div style={metaStyle}>Current status</div>
                      <div>{a.current_status || 'N/A'}</div>
                    </div>

                    <div className="d-flex justify-content-between">
                      <div style={metaStyle}>Occupancy</div>
                      <div>{a.occupancy_status || 'N/A'}</div>
                    </div>

                    <div className="d-flex justify-content-between">
                      <div style={metaStyle}>Direction ID</div>
                      <div>{a.direction_id ?? 'N/A'}</div>
                    </div>

                    <div className="d-flex justify-content-between">
                      <div style={metaStyle}>Stop sequence</div>
                      <div>{a.current_stop_sequence ?? 'N/A'}</div>
                    </div>

                    <div className="d-flex justify-content-between">
                      <div style={metaStyle}>Speed</div>
                      <div>{a.speed ?? 'N/A'}</div>
                    </div>

                    <div className="d-flex justify-content-between">
                      <div style={metaStyle}>Bearing</div>
                      <div>{a.bearing ?? 'N/A'}</div>
                    </div>

                    <div className="d-flex justify-content-between">
                      <div style={metaStyle}>Latitude</div>
                      <div>{a.latitude ?? 'N/A'}</div>
                    </div>

                    <div className="d-flex justify-content-between">
                      <div style={metaStyle}>Longitude</div>
                      <div>{a.longitude ?? 'N/A'}</div>
                    </div>

                    <div className="d-flex justify-content-between">
                      <div style={metaStyle}>Updated at</div>
                      <div>
                        {a.updated_at ? new Date(a.updated_at).toLocaleString() : 'N/A'}
                      </div>
                    </div>

                    <div className="mt-3" style={metaStyle}>
                      Route: {r?.route?.data?.id || 'N/A'} • Trip: {r?.trip?.data?.id || 'N/A'} • Stop:{' '}
                      {r?.stop?.data?.id || 'N/A'}
                    </div>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        ) : null}
      </Container>
    </div>
  );
}

export default BusSearch;

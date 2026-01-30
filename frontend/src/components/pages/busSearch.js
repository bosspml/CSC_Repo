import React, { useState, useEffect, useMemo } from 'react';
import Card from 'react-bootstrap/Card';
import Badge from 'react-bootstrap/Badge';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import Form from 'react-bootstrap/Form';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import axios from 'axios';

function Alerts() {
  // Holds the raw alert list from the API
  const [alerts, setAlerts] = useState([]);

  // Search input text
  const [query, setQuery] = useState('');

  // Loading + error handling
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Tracks which alert cards are expanded (for “More/Less”)
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    // Prevents setting state if user leaves the page before request finishes
    let isMounted = true;

    async function fetchData() {
      try {
        setLoading(true);
        setError('');

        // NOTE: You can also ask MBTA to sort on the server by using sort=-created_at,
        // but sorting on the client guarantees it regardless of server behavior.
        const result = await axios.get(
          'https://api-v3.mbta.com/alerts?filter%5Bactivity%5D=BOARD%2CEXIT%2CRIDE'
        );

        if (!isMounted) return;
        setAlerts(result.data?.data || []);
      } catch (err) {
        if (!isMounted) return;

        const message =
          err?.response?.data?.errors?.[0]?.detail ||
          err?.message ||
          'Something went wrong while fetching alerts.';
        setError(message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Formats ISO timestamps nicely (created_at / updated_at)
  function formatDateTime(isoString) {
    if (!isoString) return 'Unknown time';

    return new Date(isoString).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  // Returns a numeric timestamp for sorting (newest first)
  function getAlertTime(alert) {
    const created = alert?.attributes?.created_at;
    const updated = alert?.attributes?.updated_at;
    const best = created || updated;
    const t = best ? new Date(best).getTime() : 0;
    return Number.isFinite(t) ? t : 0;
  }

  // Limits text for compact cards. Expand shows full text.
  function clampText(text, maxChars) {
    if (!text) return '';
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars).trimEnd() + '…';
  }

  // Toggle expanded state for a specific alert id
  function toggleExpanded(id) {
    setExpanded((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  // Filter + sort results (search first, then sort newest -> oldest)
  const filteredAlerts = useMemo(() => {
    const q = query.trim().toLowerCase();

    const searched = !q
      ? alerts
      : alerts.filter((a) => {
          const header = a?.attributes?.header || '';
          const description = a?.attributes?.description || '';
          return (
            header.toLowerCase().includes(q) ||
            description.toLowerCase().includes(q)
          );
        });

    // IMPORTANT: copy array before sorting so we don’t mutate state
    return [...searched].sort((a, b) => getAlertTime(b) - getAlertTime(a));
  }, [alerts, query]);

  // ====== Simple page styling to match your screenshot vibe ======
  // Dark blue background + light text
  const pageStyle = {
    minHeight: '100vh',
    backgroundColor: '#1d96ff', // dark blue
    paddingTop: '24px',
    paddingBottom: '24px',
  };

  return (
    <div style={pageStyle}>
      <Container>
        {/* Header row */}
        <Row className="align-items-end mb-3">
          <Col xs={12} md={6}>
            <h1 className="mb-1 text-light" style={{ fontSize: '1.6rem' }}>
              MBTA Alerts
            </h1>
            <div className="text-muted">
              Showing {filteredAlerts.length} of {alerts.length}
            </div>
          </Col>

          {/* Search box */}
          <Col xs={12} md={6} className="mt-3 mt-md-0">
            <Form.Control
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your city or bus id for alerts..."
            />
          </Col>
        </Row>

        {/* Loading state */}
        {loading && (
          <div className="d-flex align-items-center gap-2 text-light">
            <Spinner animation="border" role="status" />
            <div>Loading alerts…</div>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <Alert variant="danger" className="mt-3">
            <Alert.Heading>Couldn’t load alerts</Alert.Heading>
            <div className="mb-2">{error}</div>
            <div className="text-muted">
              Tip: If you see CORS/network issues, confirm your app is running over
              http(s) properly and that requests aren’t being blocked by a proxy/firewall.
            </div>
          </Alert>
        )}

        {/* Empty state */}
        {!loading && !error && filteredAlerts.length === 0 && (
          <Alert variant="secondary" className="mt-3">
            No alerts found{query.trim() ? ' for your search.' : '.'}
          </Alert>
        )}

        {/* Card grid */}
        <Row className="mt-2 g-3">
          {!loading &&
            !error &&
            filteredAlerts.map((alert) => {
              // ====== Pull out fields safely ======
              const header = alert?.attributes?.header || 'Service Alert';
              const description =
                alert?.attributes?.description || 'No description provided.';
              const severity = alert?.attributes?.severity;
              const effect = alert?.attributes?.effect;
              const createdAt = alert?.attributes?.created_at;
              const updatedAt = alert?.attributes?.updated_at;

              // Use created_at as “Sent”, fallback to updated_at
              const sentTime = createdAt || updatedAt;

              // ====== Compact text behavior ======
              const isExpanded = !!expanded[alert.id];
              const MAX_CHARS = 140; // tweak this number to make cards shorter/longer
              const shownText = isExpanded ? description : clampText(description, MAX_CHARS);

              // ====== Border color like “status” feel (matches small alert style) ======
              const borderVariant =
                typeof severity === 'number'
                  ? severity >= 7
                    ? 'danger'
                    : severity >= 4
                    ? 'warning'
                    : 'primary'
                  : 'primary';

              // Small card styling to match your screenshot (compact + rounded)
              const cardStyle = {
                borderRadius: '14px',
                backgroundColor: '#000000', // slightly lighter than page bg
                borderColor: 'rgba(255,255,255,0.10)',
              };

              const titleStyle = {
                color: '#ffd166', // warm accent like your screenshot header
                fontSize: '1rem',
                fontWeight: 700,
              };

              const bodyTextStyle = {
                color: 'rgba(255,255,255,0.85)',
                fontSize: '0.92rem',
                lineHeight: 1.25,
                whiteSpace: 'pre-wrap',
              };

              const metaStyle = {
                color: 'rgba(255,255,255,0.65)',
                fontSize: '0.78rem',
              };

              return (
                <Col key={alert.id} xs={12} md={6} lg={4} className="d-flex">
                  <Card border={borderVariant} className="shadow-sm h-100" style={cardStyle}>
                    <Card.Body className="p-3">
                      {/* Top row: icon-ish + title + badges */}
                      <div className="d-flex justify-content-between align-items-start gap-2">
                        <div className="d-flex align-items-start gap-2">
                          {/* Simple emoji indicator (no extra library needed) */}
                          <div style={{ fontSize: '1.1rem', lineHeight: 1 }}>
                            ⚠️
                          </div>

                          <div>
                            <div style={titleStyle}>{header}</div>
                            <div style={metaStyle}>
                              Sent: {formatDateTime(sentTime)}
                            </div>
                          </div>
                        </div>

                        <div className="d-flex flex-wrap gap-1 justify-content-end">
                          {effect ? <Badge bg="info">{effect}</Badge> : null}
                          {typeof severity === 'number' ? (
                            <Badge bg="secondary">Severity {severity}</Badge>
                          ) : null}
                        </div>
                      </div>

                      {/* Description */}
                      <div className="mt-2" style={bodyTextStyle}>
                        {shownText}
                      </div>

                      {/* More/Less link (only show if text is long enough) */}
                      {description.length > MAX_CHARS ? (
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => toggleExpanded(alert.id)}
                            className="btn btn-link p-0"
                            style={{
                              color: '#9ad1ff',
                              textDecoration: 'none',
                              fontSize: '0.85rem',
                            }}
                          >
                            {isExpanded ? 'Show less' : 'More details'}
                          </button>
                        </div>
                      ) : null}

                      {/* Footer meta */}
                      <div className="mt-3 d-flex justify-content-between" style={metaStyle}>
                        <div>Alert ID: {alert.id}</div>
                        {/* Optional: show updated time too (keeps all info available) */}
                        {updatedAt ? <div>Updated: {formatDateTime(updatedAt)}</div> : <div />}
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              );
            })}
        </Row>
      </Container>
    </div>
  );
}

export default Alerts;

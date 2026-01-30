// create a page where users can input bus number then get the bus currrent location
import React, { useState } from 'react';
import axios from 'axios';

import Container from 'react-bootstrap/Container';
import Form from 'react-bootstrap/Form';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';

function RouteLookup() {
  const [routeInput, setRouteInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [route, setRoute] = useState(null);
  const [directions, setDirections] = useState([]);

  async function handleSearch(e) {
    e.preventDefault();

    const id = routeInput.trim();
    if (!id) return;

    try {
      setLoading(true);
      setError('');
      setRoute(null);
      setDirections([]);

      // 1) Get the route by ID (bus route numbers, subway line names, etc.)
      const routeRes = await axios.get(`https://api-v3.mbta.com/routes/${encodeURIComponent(id)}`);
      const routeData = routeRes.data?.data || null;

      if (!routeData) {
        setError('Route not found.');
        return;
      }

      setRoute(routeData);

      // 2) Get route patterns to infer start/end via direction headsigns
      // We group by direction_id and pick the most common headsign
      const patternsRes = await axios.get(
        `https://api-v3.mbta.com/route_patterns?filter[route]=${encodeURIComponent(id)}`
      );

      const patterns = patternsRes.data?.data || [];

      const grouped = patterns.reduce((acc, p) => {
        const dir = p?.attributes?.direction_id;
        const headsign = (p?.attributes?.direction_headsign || '').trim();
        if (dir === null || dir === undefined) return acc;
        if (!headsign) return acc;

        acc[dir] = acc[dir] || {};
        acc[dir][headsign] = (acc[dir][headsign] || 0) + 1;
        return acc;
      }, {});

      const directionSummaries = Object.keys(grouped)
        .map((dirKey) => {
          const dir = Number(dirKey);
          const headsignCounts = grouped[dir];

          // pick most frequent headsign for that direction
          let bestHeadsign = '';
          let bestCount = -1;

          Object.entries(headsignCounts).forEach(([h, c]) => {
            if (c > bestCount) {
              bestCount = c;
              bestHeadsign = h;
            }
          });

          return { direction_id: dir, headsign: bestHeadsign };
        })
        .sort((a, b) => a.direction_id - b.direction_id);

      setDirections(directionSummaries);
    } catch (err) {
      const message =
        err?.response?.data?.errors?.[0]?.detail ||
        err?.message ||
        'Something went wrong.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  // ===== Simple inline styling to match the screenshot vibe =====
  const pageStyle = {
    minHeight: '100vh',
    backgroundColor: '#121212',
    display: 'flex',
    alignItems: 'center',
  };

  const titleStyle = {
    color: 'white',
    fontSize: '2.1rem',
    fontWeight: 600,
    textAlign: 'center',
    marginBottom: '22px',
  };

  const inputWrapStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: '#2a2a2a',
    borderRadius: '999px',
    padding: '10px 14px',
    border: '1px solid rgba(255,255,255,0.08)',
  };

  const inputStyle = {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'white',
    outline: 'none',
    boxShadow: 'none',
  };

  return (
    <div style={pageStyle}>
      <Container style={{ maxWidth: '860px' }}>
        <div style={titleStyle}>What route are you taking today?</div>

        {/* Search bar */}
        <Form onSubmit={handleSearch}>
          <div style={inputWrapStyle}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '999px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255,255,255,0.06)',
                color: 'white',
                fontSize: '20px',
                userSelect: 'none',
              }}
              title="Search"
            >
              +
            </div>

            <Form.Control
              value={routeInput}
              onChange={(e) => setRouteInput(e.target.value)}
              placeholder="Enter bus/train route (ex: 1, 66, SL4, Red, Orange, Green-B)..."
              style={inputStyle}
            />

            <Button
              type="submit"
              disabled={loading}
              variant="primary"
              style={{ borderRadius: '999px', padding: '8px 16px' }}
            >
              {loading ? (
                <>
                  <Spinner size="sm" animation="border" className="me-2" />
                  Searching
                </>
              ) : (
                'Search'
              )}
            </Button>
          </div>
        </Form>

        {/* Error */}
        {error ? (
          <Alert variant="danger" className="mt-3">
            {error}
          </Alert>
        ) : null}

        {/* Result card */}
        {route ? (
          <Card
            className="mt-3 shadow-sm"
            style={{
              borderRadius: '16px',
              backgroundColor: '#1d1d1d',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <Card.Body>
              <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                Route: {route?.id}
              </div>

              <div style={{ color: 'rgba(255,255,255,0.75)', marginTop: '6px' }}>
                {route?.attributes?.long_name || 'No route name available'}
              </div>

              <div style={{ marginTop: '14px' }}>
                <div style={{ fontWeight: 700, marginBottom: '6px' }}>
                  Start & End (by direction)
                </div>

                {directions.length ? (
                  <ul style={{ margin: 0, paddingLeft: '18px', color: 'rgba(255,255,255,0.85)' }}>
                    {directions.map((d) => (
                      <li key={d.direction_id}>
                        Direction {d.direction_id}: <span style={{ color: 'white' }}>{d.headsign}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div style={{ color: 'rgba(255,255,255,0.7)' }}>
                    No direction headsigns found for this route.
                  </div>
                )}
              </div>
            </Card.Body>
          </Card>
        ) : null}
      </Container>
    </div>
  );
}

export default RouteLookup;

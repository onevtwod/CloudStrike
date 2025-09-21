import { useEffect, useState } from 'react';
import { fetchEvents, subscribeToAlerts, ApiError } from './utils/api';

type EventItem = {
	id: string;
	text: string;
	location?: string;
	eventType?: string;
	createdAt: string;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || '';
const MAPS_EMBED_KEY = import.meta.env.VITE_MAPS_EMBED_API_KEY || '';

function embedUrlForLocation(location: string) {
	const q = encodeURIComponent(location);
	return `https://www.google.com/maps/embed/v1/place?key=${MAPS_EMBED_KEY}&q=${q}`;
}

function directionsUrlForLocation(location: string) {
	const dest = encodeURIComponent(location);
	return `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
}

export default function App() {
	const [events, setEvents] = useState<EventItem[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [email, setEmail] = useState('');
	const [phone, setPhone] = useState('');
	const [subMsg, setSubMsg] = useState<string | null>(null);

	useEffect(() => {
		(async () => {
			setLoading(true);
			setError(null);
			try {
				const data = await fetchEvents(API_BASE);
				setEvents(data);
			} catch (e) {
				console.error('Failed to load events:', e);
				if (e instanceof ApiError) {
					setError(e.message);
				} else {
					setError('Failed to load events. Please check your connection and API configuration.');
				}
			} finally {
				setLoading(false);
			}
		})();
	}, []);

	async function subscribe(kind: 'email' | 'sms') {
		setSubMsg(null);
		const value = kind === 'email' ? email : phone;
		
		try {
			const data = await subscribeToAlerts(API_BASE, kind, value);
			setSubMsg(data.message);
		} catch (e) {
			console.error('Subscribe failed:', e);
			if (e instanceof ApiError) {
				setSubMsg(e.message);
			} else {
				setSubMsg('Subscribe failed. Please check your connection and API configuration.');
			}
		}
	}

	return (
		<div style={{ minHeight: '100vh', background: 'radial-gradient(1000px 600px at 10% -10%, #0ea5e9 0%, rgba(14,165,233,0) 60%), radial-gradient(800px 500px at 100% 0%, #22d3ee 0%, rgba(34,211,238,0) 60%), #0b0f14', color: '#e5f2ff' }}>
			<div style={{ maxWidth: 980, margin: '0 auto', padding: 24, fontFamily: 'Inter, ui-sans-serif, system-ui, Arial' }}>
				<h1 style={{ marginBottom: 8, letterSpacing: 0.2 }}>Disaster Events</h1>
				<p style={{ color: '#9db4c7', marginTop: 0 }}>Verified incidents from social + meteo signals</p>
				
				{loading && (
					<div style={{ padding: 20, textAlign: 'center', color: '#7dd3fc' }}>
						<div style={{ fontSize: 18, marginBottom: 8 }}>Loading events...</div>
						<div style={{ fontSize: 14, color: '#9db4c7' }}>Fetching data from API</div>
					</div>
				)}
				
				{error && (
					<div style={{ 
						padding: 16, 
						background: 'rgba(239, 68, 68, 0.1)', 
						border: '1px solid rgba(239, 68, 68, 0.3)', 
						borderRadius: 12, 
						marginBottom: 16 
					}}>
						<div style={{ color: '#fca5a5', fontWeight: 600, marginBottom: 8 }}>Error Loading Events</div>
						<div style={{ color: '#fca5a5', fontSize: 14, lineHeight: 1.5 }}>{error}</div>
						<div style={{ marginTop: 12, fontSize: 12, color: '#9db4c7' }}>
							<strong>Troubleshooting:</strong>
							<ul style={{ margin: 8, paddingLeft: 20 }}>
								<li>Check if VITE_API_BASE_URL is set in .env file</li>
								<li>Verify the backend is deployed and running</li>
								<li>Ensure the API URL is correct and accessible</li>
								<li>Check browser console for detailed error logs</li>
							</ul>
						</div>
					</div>
				)}
				{!loading && !error && events.length === 0 && (
					<div style={{ 
						padding: 40, 
						textAlign: 'center', 
						color: '#9db4c7',
						background: 'rgba(12,18,24,0.3)',
						borderRadius: 12,
						border: '1px solid rgba(148,163,184,0.18)'
					}}>
						<div style={{ fontSize: 18, marginBottom: 8, color: '#7dd3fc' }}>No Events Found</div>
						<div style={{ fontSize: 14 }}>No disaster events have been reported yet.</div>
						<div style={{ fontSize: 12, marginTop: 8, color: '#6b7280' }}>
							Events will appear here when social media posts are processed and verified.
						</div>
					</div>
				)}

				<ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 16 }}>
					{events.map(ev => (
						<li key={ev.id} style={{ border: '1px solid rgba(148,163,184,0.18)', background: 'linear-gradient(180deg, rgba(12,18,24,0.7), rgba(12,18,24,0.4))', backdropFilter: 'blur(6px)', borderRadius: 14, padding: 18, boxShadow: '0 6px 24px rgba(0,0,0,0.25)' }}>
							<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
								<div style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 12, letterSpacing: 1.2, color: '#7dd3fc' }}>{ev.eventType || 'event'}</div>
								<div style={{ color: '#8aa9bf', fontSize: 12 }}>{new Date(ev.createdAt).toLocaleString()}</div>
							</div>
							<div style={{ color: '#dbeafe', fontSize: 15, lineHeight: 1.5 }}>{ev.text}</div>
							<div style={{ color: '#93c5fd', fontSize: 12, marginTop: 6 }}>{ev.location || 'Unknown location'}</div>

							{ev.location && (
								<div style={{ marginTop: 12, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(148,163,184,0.18)' }}>
									{MAPS_EMBED_KEY ? (
										<iframe
											title={`map-${ev.id}`}
											src={embedUrlForLocation(ev.location)}
											style={{ width: '100%', height: 220, border: 0 }}
											loading="lazy"
											referrerPolicy="no-referrer-when-downgrade"
										/>
									) : (
										<a href={directionsUrlForLocation(ev.location)} target="_blank" rel="noreferrer" style={{ display: 'inline-block', width: '100%', padding: 12, textAlign: 'center', color: '#0ea5e9', background: 'rgba(14,165,233,0.08)' }}>
											Open in Google Maps →
										</a>
									)}
								</div>
							)}
						</li>
					))}
				</ul>

				<hr style={{ margin: '28px 0', borderColor: 'rgba(148,163,184,0.18)' }} />
				<h2 style={{ letterSpacing: 0.2 }}>Get Alerts</h2>
				<div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
					<input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ padding: 10, borderRadius: 10, border: '1px solid rgba(148,163,184,0.25)', background: 'rgba(2,6,12,0.6)', color: '#e5f2ff' }} />
					<button onClick={() => subscribe('email')} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(125,211,252,0.5)', background: 'linear-gradient(90deg, #0ea5e9, #22d3ee)', color: '#001014' }}>Subscribe Email</button>
				</div>
				<div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
					<input placeholder="+15551234567" value={phone} onChange={e => setPhone(e.target.value)} style={{ padding: 10, borderRadius: 10, border: '1px solid rgba(148,163,184,0.25)', background: 'rgba(2,6,12,0.6)', color: '#e5f2ff' }} />
					<button onClick={() => subscribe('sms')} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(125,211,252,0.5)', background: 'linear-gradient(90deg, #0ea5e9, #22d3ee)', color: '#001014' }}>Subscribe SMS</button>
				</div>
				{subMsg && <p style={{ color: '#9ee6ff', marginTop: 8 }}>{subMsg}</p>}
			</div>
		</div>
	);
}

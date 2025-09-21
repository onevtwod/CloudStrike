import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { fetchEvents, subscribeToAlerts, ApiError } from './utils/api';
import './App.css';
const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || '';
const MAPS_EMBED_KEY = import.meta.env.VITE_MAPS_EMBED_API_KEY || '';
function embedUrlForLocation(location) {
    const q = encodeURIComponent(location);
    return `https://www.google.com/maps/embed/v1/place?key=${MAPS_EMBED_KEY}&q=${q}`;
}
function directionsUrlForLocation(location) {
    const dest = encodeURIComponent(location);
    return `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
}
// Animated components
function PulsingDot() {
    return (_jsx("div", { className: "pulsing-dot", style: {
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: 'OrangeRed',
            display: 'inline-block',
            marginRight: 8,
            animation: 'pulse 2s infinite'
        } }));
}
function LoadingSpinner() {
    return (_jsxs("div", { className: "loading-container", style: { padding: 20, textAlign: 'center', color: '#7dd3fc' }, children: [_jsx("div", { className: "spinner", style: {
                    width: 40,
                    height: 40,
                    border: '3px solid rgba(125, 211, 252, 0.3)',
                    borderTop: '3px solid #7dd3fc',
                    borderRadius: '50%',
                    margin: '0 auto 16px',
                    animation: 'spin 1s linear infinite'
                } }), _jsx("div", { style: { fontSize: 18, marginBottom: 8 }, children: "Loading events..." }), _jsx("div", { style: { fontSize: 14, color: '#9db4c7' }, children: "Fetching data from API" })] }));
}
function AnimatedCard({ children, index, onClick }) {
    return (_jsx("li", { className: "animated-card", style: {
            border: '2px solid red',
            background: 'linear-gradient(180deg, rgba(12,18,24,0.7), rgba(12,18,24,0.4))',
            backdropFilter: 'blur(6px)',
            borderRadius: 14,
            padding: 18,
            boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
            animation: `slideInUp 0.6s ease-out ${index * 0.1}s both`,
            transition: 'all 0.3s ease',
            cursor: 'pointer'
        }, onClick: onClick, onMouseEnter: (e) => {
            e.currentTarget.style.transform = 'translateY(-5px)';
            e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.35)';
        }, onMouseLeave: (e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.25)';
        }, children: children }));
}
export default function App() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [subMsg, setSubMsg] = useState(null);
    const [selectedEvent, setSelectedEvent] = useState(null);
    useEffect(() => {
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await fetchEvents(API_BASE);
                setEvents(data);
            }
            catch (e) {
                console.error('Failed to load events:', e);
                if (e instanceof ApiError) {
                    setError(e.message);
                }
                else {
                    setError('Failed to load events. Please check your connection and API configuration.');
                }
            }
            finally {
                setLoading(false);
            }
        })();
    }, []);
    async function subscribe(kind) {
        setSubMsg(null);
        const value = kind === 'email' ? email : phone;
        try {
            const data = await subscribeToAlerts(API_BASE, kind, value);
            setSubMsg(data.message);
        }
        catch (e) {
            console.error('Subscribe failed:', e);
            if (e instanceof ApiError) {
                setSubMsg(e.message);
            }
            else {
                setSubMsg('Subscribe failed. Please check your connection and API configuration.');
            }
        }
    }
    return (_jsxs("div", { style: { minHeight: '100vh', background: '#0b0f14', color: '#e5f2ff' }, children: [_jsxs("div", { style: { maxWidth: 1400, margin: '0 auto', padding: 24, fontFamily: 'Inter, ui-sans-serif, system-ui, Arial' }, children: [_jsxs("div", { className: "header-section", style: { animation: 'fadeInDown 1s ease-out' }, children: [_jsxs("h1", { style: {
                                    color: 'OrangeRed',
                                    marginBottom: 8,
                                    letterSpacing: 0.2,
                                    display: 'flex',
                                    alignItems: 'center',
                                    fontSize: '2.5rem',
                                    fontWeight: 'bold',
                                    lineHeight: 1
                                }, children: [_jsx(PulsingDot, {}), _jsx("span", { style: {
                                            fontSize: '2.5rem',
                                            marginRight: '0.3rem',
                                            display: 'flex',
                                            alignItems: 'center'
                                        }, children: "\u26A0\uFE0F" }), _jsx("span", { style: {
                                            display: 'flex',
                                            alignItems: 'center'
                                        }, children: "Disaster Events" })] }), _jsx("p", { style: {
                                    color: 'lawngreen',
                                    marginTop: 20,
                                    fontSize: '1.1rem',
                                    animation: 'fadeInUp 1s ease-out 0.3s both'
                                }, children: "\u2705 Verified incidents from social media + meteo signals" })] }), loading && _jsx(LoadingSpinner, {}), error && (_jsxs("div", { className: "error-alert", style: {
                            padding: 16,
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: 12,
                            marginBottom: 16,
                            animation: 'shake 0.5s ease-in-out'
                        }, children: [_jsx("div", { style: { color: '#fca5a5', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center' }, children: "\u26A0\uFE0F Error Loading Events" }), _jsx("div", { style: { color: '#fca5a5', fontSize: 14, lineHeight: 1.5 }, children: error }), _jsxs("div", { style: { marginTop: 12, fontSize: 12, color: '#9db4c7' }, children: [_jsx("strong", { children: "Troubleshooting:" }), _jsxs("ul", { style: { margin: 8, paddingLeft: 20 }, children: [_jsx("li", { children: "Check if VITE_API_BASE_URL is set in .env file" }), _jsx("li", { children: "Verify the backend is deployed and running" }), _jsx("li", { children: "Ensure the API URL is correct and accessible" }), _jsx("li", { children: "Check browser console for detailed error logs" })] })] })] })), !loading && !error && events.length === 0 && (_jsxs("div", { className: "no-events-card", style: {
                            padding: 40,
                            textAlign: 'center',
                            color: '#9db4c7',
                            background: 'rgba(12,18,24,0.3)',
                            borderRadius: 12,
                            border: '1px solid rgba(148,163,184,0.18)',
                            animation: 'fadeInUp 1s ease-out'
                        }, children: [_jsx("div", { style: { fontSize: 48, marginBottom: 16 }, children: "\uD83D\uDCE1" }), _jsx("div", { style: { fontSize: 18, marginBottom: 8, color: '#7dd3fc' }, children: "No Events Found" }), _jsx("div", { style: { fontSize: 14 }, children: "No disaster events have been reported yet." }), _jsx("div", { style: { fontSize: 12, marginTop: 8, color: '#6b7280' }, children: "Events will appear here when social media posts are processed and verified." })] })), _jsx("ul", { className: "event-grid", children: events.map((ev, index) => (_jsxs(AnimatedCard, { index: index, onClick: () => setSelectedEvent(ev), children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }, children: [_jsxs("div", { style: {
                                                fontWeight: 700,
                                                textTransform: 'uppercase',
                                                fontSize: 15,
                                                letterSpacing: 1.2,
                                                color: 'OrangeRed',
                                                display: 'flex',
                                                alignItems: 'center',
                                            }, children: ["\u26A0\uFE0F ", ev.eventType || 'event'] }), _jsx("div", { style: {
                                                fontWeight: 700,
                                                color: '#ffffff',
                                                fontSize: 15,
                                                opacity: 1
                                            }, children: new Date(ev.createdAt).toLocaleString() })] }), _jsx("div", { style: {
                                        color: 'FloralWhite',
                                        fontSize: 15,
                                        lineHeight: 1.5,
                                        marginBottom: 8
                                    }, children: ev.text }), _jsxs("div", { style: {
                                        color: '#93c5fd',
                                        fontSize: 15,
                                        marginTop: 6,
                                        display: 'flex',
                                        alignItems: 'center'
                                    }, children: ["\uD83D\uDCCD ", ev.location || 'Unknown location'] }), ev.location && (_jsx("div", { style: {
                                        marginTop: 12,
                                        borderRadius: 12,
                                        overflow: 'hidden',
                                        border: '1px solid rgba(148,163,184,0.18)',
                                        transition: 'all 0.3s ease'
                                    }, children: MAPS_EMBED_KEY ? (_jsx("iframe", { title: `map-${ev.id}`, src: embedUrlForLocation(ev.location), style: { width: '100%', height: 220, border: 0 }, loading: "lazy", referrerPolicy: "no-referrer-when-downgrade" })) : (_jsx("a", { href: directionsUrlForLocation(ev.location), target: "_blank", rel: "noreferrer", className: "map-link", style: {
                                            display: 'inline-block',
                                            width: '100%',
                                            padding: 12,
                                            textAlign: 'center',
                                            color: '#0ea5e9',
                                            background: 'rgba(14,165,233,0.08)',
                                            transition: 'all 0.3s ease',
                                            textDecoration: 'none'
                                        }, onMouseEnter: (e) => {
                                            e.currentTarget.style.background = 'rgba(14,165,233,0.15)';
                                            e.currentTarget.style.transform = 'scale(1.02)';
                                        }, onMouseLeave: (e) => {
                                            e.currentTarget.style.background = 'rgba(14,165,233,0.08)';
                                            e.currentTarget.style.transform = 'scale(1)';
                                        }, children: "\uD83D\uDDFA\uFE0F Open in Google Maps \u2192" })) }))] }, ev.id))) }), _jsx("hr", { style: { margin: '28px 0', borderColor: 'rgba(148,163,184,0.18)' } }), _jsxs("div", { className: "subscription-section", style: { animation: 'fadeInUp 1s ease-out 0.5s both' }, children: [_jsx("h2", { style: {
                                    letterSpacing: 0.2,
                                    display: 'flex',
                                    alignItems: 'center',
                                    fontSize: '1.8rem',
                                    marginBottom: 16
                                }, children: "\uD83D\uDD14 Get Alerts" }), _jsxs("div", { style: { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }, children: [_jsx("input", { placeholder: "\uD83D\uDCE7 Enter your email", value: email, onChange: e => setEmail(e.target.value), className: "alert-input", style: {
                                            padding: 12,
                                            borderRadius: 10,
                                            border: '1px solid rgba(148,163,184,0.25)',
                                            background: 'rgba(2,6,12,0.6)',
                                            color: '#e5f2ff',
                                            fontSize: 14,
                                            minWidth: 200,
                                            transition: 'all 0.3s ease'
                                        }, onFocus: (e) => {
                                            e.currentTarget.style.borderColor = '#0ea5e9';
                                            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(14,165,233,0.1)';
                                        }, onBlur: (e) => {
                                            e.currentTarget.style.borderColor = 'rgba(148,163,184,0.25)';
                                            e.currentTarget.style.boxShadow = 'none';
                                        } }), _jsx("button", { onClick: () => subscribe('email'), className: "alert-button", style: {
                                            padding: '12px 16px',
                                            borderRadius: 10,
                                            border: '2px solid #ff4444',
                                            background: '#ff4444',
                                            color: '#ffffff',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            transition: 'all 0.3s ease',
                                            width: '200px'
                                        }, onMouseEnter: (e) => {
                                            e.currentTarget.style.animation = 'breathe 1.5s ease-in-out infinite';
                                            e.currentTarget.style.boxShadow = '0 4px 20px rgba(255, 68, 68, 0.4)';
                                            e.currentTarget.style.background = '#ff6666';
                                        }, onMouseLeave: (e) => {
                                            e.currentTarget.style.animation = 'none';
                                            e.currentTarget.style.boxShadow = 'none';
                                            e.currentTarget.style.background = '#ff4444';
                                        }, children: "\uD83D\uDCE7 Subscribe Email" })] }), _jsxs("div", { style: { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }, children: [_jsx("input", { placeholder: "\uD83D\uDCF1 +15551234567", value: phone, onChange: e => setPhone(e.target.value), className: "alert-input", style: {
                                            padding: 12,
                                            borderRadius: 10,
                                            border: '1px solid rgba(148,163,184,0.25)',
                                            background: 'rgba(2,6,12,0.6)',
                                            color: '#e5f2ff',
                                            fontSize: 14,
                                            minWidth: 200,
                                            transition: 'all 0.3s ease'
                                        }, onFocus: (e) => {
                                            e.currentTarget.style.borderColor = '#0ea5e9';
                                            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(14,165,233,0.1)';
                                        }, onBlur: (e) => {
                                            e.currentTarget.style.borderColor = 'rgba(148,163,184,0.25)';
                                            e.currentTarget.style.boxShadow = 'none';
                                        } }), _jsx("button", { onClick: () => subscribe('sms'), className: "alert-button", style: {
                                            padding: '12px 16px',
                                            borderRadius: 10,
                                            border: '2px solid #ff4444',
                                            background: '#ff4444',
                                            color: '#ffffff',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            transition: 'all 0.3s ease',
                                            width: '200px'
                                        }, onMouseEnter: (e) => {
                                            e.currentTarget.style.animation = 'breathe 1.5s ease-in-out infinite';
                                            e.currentTarget.style.boxShadow = '0 4px 20px rgba(255, 68, 68, 0.4)';
                                            e.currentTarget.style.background = '#ff6666';
                                        }, onMouseLeave: (e) => {
                                            e.currentTarget.style.animation = 'none';
                                            e.currentTarget.style.boxShadow = 'none';
                                            e.currentTarget.style.background = '#ff4444';
                                        }, children: "\uD83D\uDCF1 Subscribe SMS" })] }), subMsg && (_jsxs("p", { style: {
                                    color: '#9ee6ff',
                                    marginTop: 12,
                                    padding: 8,
                                    borderRadius: 6,
                                    background: 'rgba(158,230,255,0.1)',
                                    animation: 'fadeInUp 0.5s ease-out'
                                }, children: ["\u2705 ", subMsg] }))] })] }), selectedEvent && (_jsx("div", { style: {
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: 20
                }, onClick: () => setSelectedEvent(null), children: _jsxs("div", { style: {
                        backgroundColor: '#1a1a1a',
                        border: '3px solid red',
                        borderRadius: 14,
                        padding: 30,
                        maxWidth: '90vw',
                        maxHeight: '80vh',
                        color: '#e5f2ff',
                        position: 'relative',
                        overflow: 'auto'
                    }, onClick: (e) => e.stopPropagation(), children: [_jsx("button", { onClick: () => setSelectedEvent(null), style: {
                                position: 'absolute',
                                top: 15,
                                right: 15,
                                background: 'transparent',
                                border: 'none',
                                color: '#fff',
                                fontSize: 24,
                                cursor: 'pointer',
                                padding: 0,
                                width: 30,
                                height: 30,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }, children: "\u00D7" }), _jsxs("div", { style: {
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                fontSize: 18,
                                letterSpacing: 1.2,
                                color: 'OrangeRed',
                                marginBottom: 15,
                                display: 'flex',
                                alignItems: 'center'
                            }, children: ["\u26A0\uFE0F ", selectedEvent.eventType || 'event'] }), _jsx("div", { style: {
                                fontWeight: 700,
                                color: '#ffffff',
                                fontSize: 16,
                                marginBottom: 20
                            }, children: new Date(selectedEvent.createdAt).toLocaleString() }), _jsx("div", { style: {
                                color: 'FloralWhite',
                                fontSize: 16,
                                lineHeight: 1.6,
                                marginBottom: 20,
                                whiteSpace: 'pre-wrap'
                            }, children: selectedEvent.text }), _jsxs("div", { style: {
                                color: '#93c5fd',
                                fontSize: 14,
                                display: 'flex',
                                alignItems: 'center',
                                marginBottom: 20
                            }, children: ["\uD83D\uDCCD ", selectedEvent.location || 'Unknown location'] }), selectedEvent.location && (_jsx("div", { style: {
                                borderRadius: 12,
                                overflow: 'hidden',
                                border: '1px solid rgba(148,163,184,0.18)'
                            }, children: MAPS_EMBED_KEY ? (_jsx("iframe", { title: `modal-map-${selectedEvent.id}`, src: embedUrlForLocation(selectedEvent.location), style: { width: '100%', height: 300, border: 0 }, loading: "lazy", referrerPolicy: "no-referrer-when-downgrade" })) : (_jsx("a", { href: directionsUrlForLocation(selectedEvent.location), target: "_blank", rel: "noreferrer", style: {
                                    display: 'inline-block',
                                    width: '100%',
                                    padding: 15,
                                    textAlign: 'center',
                                    color: '#0ea5e9',
                                    background: 'rgba(14,165,233,0.08)',
                                    textDecoration: 'none'
                                }, children: "\uD83D\uDDFA\uFE0F Open in Google Maps \u2192" })) }))] }) }))] }));
}

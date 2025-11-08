// frontend/src/pages/PublicProfilePage.jsx
import React, { useState, useEffect } from 'react';
import { useAuth,BadgeDisplay } from '../App'; // Use auth to get axiosInstance
import { useParams, Link } from 'react-router-dom'; // Import Link
import { Container, Card, Spinner, Alert, Badge, Row, Col, Image, ListGroup } from 'react-bootstrap';
import { User, Briefcase, DollarSign, Link as LinkIcon, MapPin, Clock, Check, Tags } from 'lucide-react'; // Added Tags

// Use environment variable for API URL or default
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const PublicProfilePage = () => {
    const { username } = useParams();
    const { axiosInstance } = useAuth(); // Use axiosInstance for auth headers if needed (for consistency)
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Function to construct full image URL
    const getFullImageUrl = (url) => {
        if (!url) return null;
        if (url.startsWith('http') || url.startsWith('blob:')) return url;
        return `${API_BASE_URL}${url}`;
    };

    useEffect(() => {
        const fetchProfile = async () => {
            setLoading(true);
            setError('');
            try {
                // Use the new public-profiles endpoint with username lookup
                const response = await axiosInstance.get(`/public-profiles/${username}/`);
                setProfile(response.data);
            } catch (err) {
                if (err.response && err.response.status === 404) {
                    setError('User not found.');
                } else {
                    setError('Failed to fetch profile data.');
                }
                console.error("Fetch public profile error:", err.response?.data || err.message || err);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [username, axiosInstance]); // Refetch if username changes

    if (loading) {
        return <Container className="text-center py-5"><Spinner animation="border" /></Container>;
    }

    if (error) {
        return <Container className="py-5"><Alert variant="danger">{error}</Alert></Container>;
    }

    if (!profile) {
        return <Container className="py-5"><Alert variant="warning">Profile could not be loaded.</Alert></Container>;
    }

    const displayImageUrl = getFullImageUrl(profile.profile_picture) || `https://via.placeholder.com/100/007bff/FFFFFF?text=${profile.user.charAt(0).toUpperCase() || 'U'}`;

    // Import BadgeDisplay from App.jsx
    // eslint-disable-next-line
    //const BadgeDisplay = require('../App').default?.BadgeDisplay || require('../App').BadgeDisplay;

    return (
        <Container className="py-5">
            <Row className="justify-content-center">
                <Col md={8}>
                    <Card className="shadow-sm">
                        <Card.Header as="h2" className="d-flex justify-content-between align-items-center bg-light">
                            <span><User className="me-2" />Profile</span>
                        </Card.Header>
                        <Card.Body>
                            <div className="text-center mb-4">
                                <Image src={displayImageUrl} roundedCircle style={{ width: '100px', height: '100px', objectFit: 'cover', border: '1px solid #dee2e6' }} />
                                <h3 className="mt-3">
                                    {profile.user}
                                    {profile.is_verified && (
                                        <Badge bg="primary" className="ms-2" title="Verified">
                                            <Check size={16} /> Verified
                                        </Badge>
                                    )}
                                </h3>
                                <p className="text-muted">{profile.headline || 'No headline set'}</p>
                                {/* Show earned badges for the public profile user */}
                                <div className="mb-3">
                                    <BadgeDisplay userId={profile.id} />
                                </div>
                            </div>
                            <p><Briefcase size={16} className="me-2 text-primary" /> <Badge bg="info" className="fs-6">{profile.user_type}</Badge></p>
                            <hr />
                            <h5>About</h5>
                            <p>{profile.bio || <span className="text-muted">No bio provided.</span>}</p>
                            <Row className="mb-3">
                                <Col md={6}><MapPin size={16} className="me-2 text-muted" /> {profile.country || <span className="text-muted">Country not set</span>}</Col>
                                <Col md={6}><Clock size={16} className="me-2 text-muted" /> {profile.timezone || <span className="text-muted">Timezone not set</span>}</Col>
                            </Row>
                            {profile.portfolio_link && (
                                <p><LinkIcon size={16} className="me-2 text-muted" /> <a href={profile.portfolio_link} target="_blank" rel="noopener noreferrer">Portfolio</a></p>
                            )}
                            {profile.user_type === 'freelancer' && (
                                <>
                                    {profile.hourly_rate && (
                                        <p><DollarSign size={16} className="me-2 text-success" /> <strong>Hourly Rate:</strong> {profile.hourly_rate ? `₹${profile.hourly_rate}` : <span className="text-muted">Not set</span>}</p>
                                    )}
                                    <hr />
                                    <h5><Tags size={16} className="me-1" /> Skills</h5>
                                    <div>
                                        {profile.skills?.length > 0 ? profile.skills.map(skill => (
                                            <Badge key={skill.id} pill bg="light" text="dark" className="me-1 mb-1 border">{skill.name}</Badge>
                                        )) : <span className="text-muted">No skills added.</span>}
                                    </div>
                                    <hr />
                                    <h5>Portfolio Items</h5>
                                    {profile.portfolio_items?.length > 0 ? (
                                        <ListGroup variant="flush">
                                            {profile.portfolio_items.map(item => (
                                                <ListGroup.Item key={item.id} className="d-flex justify-content-between align-items-start">
                                                    <div className="me-auto">
                                                        <div className="fw-bold">{item.title}</div>
                                                        <small className="text-muted">{item.description}</small>
                                                        {item.link && <><br /><a href={item.link} target="_blank" rel="noopener noreferrer"><LinkIcon size={12} /> View Link</a></>}
                                                        {item.image && <><br /><Image src={getFullImageUrl(item.image)} thumbnail width={80} className="mt-1" /></>}
                                                    </div>
                                                </ListGroup.Item>
                                            ))}
                                        </ListGroup>
                                    ) : (
                                        <p className="text-muted">No portfolio items added yet.</p>
                                    )}
                                </>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
};

export default PublicProfilePage;
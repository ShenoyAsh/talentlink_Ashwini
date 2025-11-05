// frontend/src/pages/FreelancerSearchPage.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { Container, Card, Form, Button, Spinner, Alert, Row, Col, Badge, Image } from 'react-bootstrap';
import { Search, User, Check, Star, Briefcase } from 'lucide-react';
import { Link } from 'react-router-dom'; // Import Link

// Use environment variable for API URL or default
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const FreelancerSearchPage = () => {
    const { axiosInstance } = useAuth();
    const [freelancers, setFreelancers] = useState([]);
    const [loading, setLoading] = useState(false); // Only load on search
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [skillTerm, setSkillTerm] = useState('');
    const [availableSkills, setAvailableSkills] = useState([]);

    // Function to construct full image URL
    const getFullImageUrl = (url) => {
        if (!url) return null;
        if (url.startsWith('http') || url.startsWith('blob:')) return url;
        return `${API_BASE_URL}${url}`;
    };
    
    // Fetch available skills for the dropdown
    useEffect(() => {
        const fetchSkills = async () => {
            try {
                const response = await axiosInstance.get('/skills/');
                setAvailableSkills(response.data.results || response.data);
            } catch (err) {
                console.error("Failed to fetch skills:", err);
            }
        };
        fetchSkills();
    }, [axiosInstance]);

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            if (searchTerm) {
                params.append('search', searchTerm);
            }
            if (skillTerm) {
                // Backend filterset_fields is 'skills__name'
                params.append('skills__name', skillTerm);
            }
            
            const response = await axiosInstance.get('/freelancers/', { params });
            setFreelancers(response.data.results || response.data);
            
            if (response.data.results?.length === 0 || response.data.length === 0) {
                 setError("No freelancers found matching your criteria."); // Use error state for "not found"
            }

        } catch (err) {
            setError('Failed to fetch freelancers.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container className="py-5">
            <h1 className="mb-4">Find Freelancers</h1>
            <Card className="p-3 mb-4 shadow-sm">
                <Form onSubmit={handleSearch}>
                    <Row className="g-3">
                        <Col md={6}>
                            <Form.Group>
                                <Form.Label>Search by Keyword</Form.Label>
                                <InputGroup>
                                    <Form.Control
                                        placeholder="e.g., React Developer, 'John Doe'"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </InputGroup>
                            </Form.Group>
                        </Col>
                        <Col md={4}>
                             <Form.Group>
                                <Form.Label>Filter by Skill</Form.Label>
                                <Form.Select
                                    value={skillTerm}
                                    onChange={(e) => setSkillTerm(e.target.value)}
                                >
                                    <option value="">All Skills</option>
                                    {availableSkills.map(skill => (
                                        <option key={skill.id} value={skill.name}>{skill.name}</option>
                                    ))}
                                </Form.Select>
                            </Form.Group>
                        </Col>
                        <Col md={2} className="d-flex align-items-end">
                            <Button type="submit" variant="primary" className="w-100" disabled={loading}>
                                {loading ? <Spinner as="span" size="sm" /> : <Search size={18} />}
                            </Button>
                        </Col>
                    </Row>
                </Form>
            </Card>

            {/* Results */}
            {loading && <div className="text-center"><Spinner animation="border" /></div>}
            
            {error && !loading && <Alert variant={freelancers.length > 0 ? "danger" : "info"}>{error}</Alert>}
            
            {!loading && freelancers.length > 0 && (
                <Row xs={1} md={2} lg={3} className="g-4">
                    {freelancers.map(profile => (
                        <Col key={profile.id}>
                            <Card className="h-100 shadow-sm">
                                <Card.Body className="d-flex flex-column">
                                    <div className="text-center mb-3">
                                        <Image
                                            src={getFullImageUrl(profile.profile_picture) || `https://via.placeholder.com/80/007bff/FFFFFF?text=${profile.user.charAt(0).toUpperCase()}`}
                                            roundedCircle
                                            style={{ width: '80px', height: '80px', objectFit: 'cover', border: '1px solid #dee2e6' }}
                                        />
                                    </div>
                                    <Card.Title className="text-center">
                                        <Link to={`/user/${profile.user}`} className="text-decoration-none stretched-link">
                                            {profile.user}
                                        </Link>
                                        {profile.is_verified && (
                                            <Badge bg="primary" className="ms-2" title="Verified Freelancer">
                                                <Check size={14} />
                                            </Badge>
                                        )}
                                    </Card.Title>
                                    <Card.Text className="text-center text-muted flex-grow-1">
                                        {profile.headline || <span className="fst-italic">No headline</span>}
                                    </Card.Text>
                                    <div className="mt-auto pt-2 border-top">
                                        <div className="mb-2">
                                            {profile.skills.length > 0 ? (
                                                profile.skills.slice(0, 5).map(skill => ( // Show max 5 skills
                                                    <Badge key={skill.id} pill bg="light" text="dark" className="me-1 mb-1 border">{skill.name}</Badge>
                                                ))
                                            ) : (
                                                <small className="text-muted">No skills listed.</small>
                                            )}
                                        </div>
                                        {profile.hourly_rate && (
                                             <p className="text-success fw-bold mb-0 text-end">
                                                ₹{profile.hourly_rate} / hr
                                            </p>
                                        )}
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>
                    ))}
                </Row>
            )}
        </Container>
    );
};

export default FreelancerSearchPage;
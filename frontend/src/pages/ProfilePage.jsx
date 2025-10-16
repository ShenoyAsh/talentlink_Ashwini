import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { Container, Card, Form, Button, Spinner, Alert, Badge, Row, Col } from 'react-bootstrap';
import { User, Briefcase, DollarSign, Link as LinkIcon, Save, MapPin, Clock } from 'lucide-react';

const ProfilePage = () => {
    const { user, axiosInstance } = useAuth();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({});

    useEffect(() => {
        const fetchProfile = async () => {
            if (!user) return;
            try {
                const response = await axiosInstance.get(`/profiles/${user.profileId}/`);
                setProfile(response.data);
                setFormData(response.data);
            } catch (err) {
                setError('Failed to fetch profile data.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [user, axiosInstance]);

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSaveChanges = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await axiosInstance.put(`/profiles/${user.profileId}/`, formData);
            setProfile(formData);
            setIsEditing(false);
        } catch (err) {
            setError('Failed to update profile.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <Container className="text-center py-5"><Spinner animation="border" /></Container>;
    }

    if (error) {
        return <Container><Alert variant="danger">{error}</Alert></Container>;
    }

    if (!profile) {
        return <Container><Alert variant="warning">No profile found.</Alert></Container>;
    }

    return (
        <Container className="py-5">
            <Row className="justify-content-center">
                <Col md={8}>
                    <Card className="shadow-sm">
                        <Card.Header as="h2" className="d-flex justify-content-between align-items-center">
                            Profile
                            <Button variant="outline-primary" size="sm" onClick={() => setIsEditing(!isEditing)}>
                                {isEditing ? 'Cancel' : 'Edit Profile'}
                            </Button>
                        </Card.Header>
                        <Card.Body>
                            {isEditing ? (
                                <Form onSubmit={handleSaveChanges}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Headline</Form.Label>
                                        <Form.Control
                                            type="text"
                                            name="headline"
                                            value={formData.headline || ''}
                                            onChange={handleInputChange}
                                        />
                                    </Form.Group>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Bio</Form.Label>
                                        <Form.Control
                                            as="textarea"
                                            rows={4}
                                            name="bio"
                                            value={formData.bio || ''}
                                            onChange={handleInputChange}
                                        />
                                    </Form.Group>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Country</Form.Label>
                                        <Form.Control
                                            type="text"
                                            name="country"
                                            value={formData.country || ''}
                                            onChange={handleInputChange}
                                        />
                                    </Form.Group>
                                     <Form.Group className="mb-3">
                                        <Form.Label>Timezone</Form.Label>
                                        <Form.Control
                                            type="text"
                                            name="timezone"
                                            value={formData.timezone || ''}
                                            onChange={handleInputChange}
                                        />
                                    </Form.Group>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Portfolio Link</Form.Label>
                                        <Form.Control
                                            type="text"
                                            name="portfolio_link"
                                            value={formData.portfolio_link || ''}
                                            onChange={handleInputChange}
                                        />
                                    </Form.Group>
                                    {user.user_type === 'freelancer' && (
                                        <Form.Group className="mb-3">
                                            <Form.Label>Hourly Rate ($)</Form.Label>
                                            <Form.Control
                                                type="number"
                                                name="hourly_rate"
                                                value={formData.hourly_rate || ''}
                                                onChange={handleInputChange}
                                            />
                                        </Form.Group>
                                    )}
                                    <Button type="submit" variant="primary" disabled={loading}>
                                        <Save size={16} className="me-2" />
                                        {loading ? 'Saving...' : 'Save Changes'}
                                    </Button>
                                </Form>
                            ) : (
                                <>
                                    <div className="text-center mb-4">
                                        <User size={80} className="mb-3" />
                                        <h3>{profile.user}</h3>
                                        <p className="text-muted">{profile.headline}</p>
                                    </div>
                                    <p><Briefcase size={16} className="me-2" /> <Badge bg="info">{profile.user_type}</Badge></p>
                                    <p>{profile.bio}</p>
                                    {profile.country && <p><MapPin size={16} className="me-2" /> {profile.country}</p>}
                                    {profile.timezone && <p><Clock size={16} className="me-2" /> {profile.timezone}</p>}
                                    {profile.portfolio_link && (
                                        <p><LinkIcon size={16} className="me-2" /> <a href={profile.portfolio_link} target="_blank" rel="noopener noreferrer">Portfolio</a></p>
                                    )}
                                    {profile.user_type === 'freelancer' && (
                                        <p><DollarSign size={16} className="me-2" /> <strong>Hourly Rate:</strong> ${profile.hourly_rate}</p>
                                    )}
                                    <h5>Skills</h5>
                                    <div>
                                        {profile.skills.map(skill => (
                                            <Badge key={skill.id} bg="secondary" className="me-2 mb-2">{skill.name}</Badge>
                                        ))}
                                    </div>
                                </>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
};

export default ProfilePage;
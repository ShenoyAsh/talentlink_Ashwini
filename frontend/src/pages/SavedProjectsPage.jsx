// frontend/src/pages/SavedProjectsPage.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { Container, Card, Spinner, Alert, Row, Col, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';

const SavedProjectsPage = () => {
    const { user, axiosInstance } = useAuth();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchSavedProjects = async () => {
            if (!user || user.user_type !== 'freelancer') {
                setError("Only freelancers can save projects.");
                setLoading(false);
                return;
            }
            setLoading(true);
            setError('');
            try {
                // Use the custom action endpoint
                const response = await axiosInstance.get('/profiles/saved-projects/');
                setProjects(response.data.results || response.data); // Handle pagination if any
            } catch (err) {
                setError('Failed to fetch saved projects.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchSavedProjects();
    }, [user, axiosInstance]);

    if (loading) {
        return <Container className="text-center py-5"><Spinner animation="border" /></Container>;
    }

    if (error) {
        return <Container><Alert variant="danger">{error}</Alert></Container>;
    }

    return (
        <Container className="py-5">
            <h1 className="mb-4">My Saved Projects</h1>

            {projects.length > 0 ? (
                <Row xs={1} md={2} lg={3} className="g-4">
                    {projects.map(project => (
                        <Col key={project.id}>
                            <Card className="h-100 shadow-sm project-card">
                                <Card.Body className="d-flex flex-column">
                                    <Card.Title>
                                        <Link to={`/project/${project.id}`} className="text-decoration-none stretched-link">
                                            {project.title}
                                        </Link>
                                    </Card.Title>
                                    <Card.Subtitle className="mb-2 text-muted">
                                        Client: <Link to={`/user/${project.client}`}>{project.client}</Link>
                                        <Badge bg={project.status === 'open' ? 'success' : 'secondary'} className="ms-2">
                                            {project.status}
                                        </Badge>
                                    </Card.Subtitle>
                                    <Card.Text className="flex-grow-1">
                                        {project.description.length > 100 ? project.description.substring(0, 100) + '...' : project.description}
                                    </Card.Text>
                                    <div className="d-flex justify-content-between align-items-center mt-auto pt-2 border-top">
                                        <span className="fw-bold fs-5 text-success">₹{project.budget}</span>
                                        <small className="text-muted">{new Date(project.created_at).toLocaleDateString()}</small>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>
                    ))}
                </Row>
            ) : (
                <Alert variant="info">You have not saved any projects yet. <Link to="/projects">Find projects</Link> to save!</Alert>
            )}
        </Container>
    );
};

export default SavedProjectsPage;
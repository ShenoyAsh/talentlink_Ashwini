// frontend/src/pages/MilestonesPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Container, Card, Row, Col, Button, Badge, Modal, Form, Alert, Spinner, Table } from 'react-bootstrap';
import { CheckCircle, Clock, XCircle, Plus, FileText } from 'lucide-react';
import { useAuth } from '../App';

const MilestonesPage = () => {
    const { id: projectId } = useParams();
    const { user, axiosInstance } = useAuth();
    const [milestones, setMilestones] = useState([]);
    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ title: '', description: '', amount: '', due_date: '' });
    const [error, setError] = useState('');

    useEffect(() => {
        if (projectId) {
            fetchMilestones();
            fetchProject();
        }
    }, [projectId, axiosInstance]);

    const fetchMilestones = async () => {
        try {
            const response = await axiosInstance.get(`/milestones/?project=${projectId}`);
            setMilestones(response.data.results || response.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchProject = async () => {
        try {
            const response = await axiosInstance.get(`/projects/${projectId}/`);
            setProject(response.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await axiosInstance.post('/milestones/', {
                ...formData,
                project: projectId,
                amount: parseFloat(formData.amount)
            });
            setShowModal(false);
            setFormData({ title: '', description: '', amount: '', due_date: '' });
            fetchMilestones();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to create milestone.');
        }
    };

    const handleStatusUpdate = async (milestoneId, newStatus) => {
        try {
            await axiosInstance.patch(`/milestones/${milestoneId}/`, { status: newStatus });
            fetchMilestones();
        } catch (err) {
            alert('Failed to update milestone status.');
        }
    };

    const getStatusBadge = (status) => {
        const variants = {
            pending: { bg: 'warning', icon: <Clock size={16} /> },
            in_progress: { bg: 'info', icon: <Clock size={16} /> },
            completed: { bg: 'success', icon: <CheckCircle size={16} /> },
            approved: { bg: 'primary', icon: <CheckCircle size={16} /> }
        };
        const config = variants[status] || variants.pending;
        return <Badge bg={config.bg}>{config.icon} {status.replace('_', ' ')}</Badge>;
    };

    if (loading) return <Container className="text-center py-5"><Spinner animation="border" /></Container>;

    return (
        <Container className="py-5 animate-fade-in">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h1 className="gradient-text mb-2">Project Milestones</h1>
                    {project && <p className="text-muted mb-0">Project: <Link to={`/project/${projectId}`}>{project.title}</Link></p>}
                </div>
                {user?.user_type === 'client' && project?.client === user?.username && (
                    <Button variant="primary" onClick={() => setShowModal(true)}>
                        <Plus className="me-2" /> Add Milestone
                    </Button>
                )}
            </div>

            {error && <Alert variant="danger" onClose={() => setError('')} dismissible>{error}</Alert>}

            {milestones.length > 0 ? (
                <Row className="g-4">
                    {milestones.map(milestone => (
                        <Col md={6} lg={4} key={milestone.id}>
                            <Card className="shadow-sm h-100">
                                <Card.Header className="d-flex justify-content-between align-items-center">
                                    <strong>{milestone.title}</strong>
                                    {getStatusBadge(milestone.status)}
                                </Card.Header>
                                <Card.Body>
                                    {milestone.description && <p className="text-muted">{milestone.description}</p>}
                                    <div className="mb-3">
                                        <strong className="text-success">₹{parseFloat(milestone.amount).toFixed(2)}</strong>
                                    </div>
                                    {milestone.due_date && (
                                        <p className="small text-muted mb-0">
                                            Due: {new Date(milestone.due_date).toLocaleDateString()}
                                        </p>
                                    )}
                                    {user?.user_type === 'freelancer' && milestone.status === 'pending' && (
                                        <Button 
                                            size="sm" 
                                            variant="success" 
                                            className="mt-2"
                                            onClick={() => handleStatusUpdate(milestone.id, 'in_progress')}
                                        >
                                            Start Work
                                        </Button>
                                    )}
                                    {user?.user_type === 'freelancer' && milestone.status === 'in_progress' && (
                                        <Button 
                                            size="sm" 
                                            variant="primary" 
                                            className="mt-2"
                                            onClick={() => handleStatusUpdate(milestone.id, 'completed')}
                                        >
                                            Mark Complete
                                        </Button>
                                    )}
                                    {user?.user_type === 'client' && milestone.status === 'completed' && (
                                        <Button 
                                            size="sm" 
                                            variant="success" 
                                            className="mt-2"
                                            onClick={() => handleStatusUpdate(milestone.id, 'approved')}
                                        >
                                            Approve
                                        </Button>
                                    )}
                                </Card.Body>
                            </Card>
                        </Col>
                    ))}
                </Row>
            ) : (
                <Alert variant="info">No milestones yet. {user?.user_type === 'client' && 'Create one to get started!'}</Alert>
            )}

            <Modal show={showModal} onHide={() => setShowModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Create Milestone</Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleSubmit}>
                    <Modal.Body>
                        <Form.Group className="mb-3">
                            <Form.Label>Title *</Form.Label>
                            <Form.Control
                                value={formData.title}
                                onChange={(e) => setFormData({...formData, title: e.target.value})}
                                required
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Description</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={3}
                                value={formData.description}
                                onChange={(e) => setFormData({...formData, description: e.target.value})}
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Amount (₹) *</Form.Label>
                            <Form.Control
                                type="number"
                                step="0.01"
                                value={formData.amount}
                                onChange={(e) => setFormData({...formData, amount: e.target.value})}
                                required
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Due Date</Form.Label>
                            <Form.Control
                                type="date"
                                value={formData.due_date}
                                onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                            />
                        </Form.Group>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
                        <Button variant="primary" type="submit">Create</Button>
                    </Modal.Footer>
                </Form>
            </Modal>
        </Container>
    );
};

export default MilestonesPage;


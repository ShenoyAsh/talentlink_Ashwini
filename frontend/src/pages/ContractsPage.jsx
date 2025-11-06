import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { Container, Card, Spinner, Alert, ListGroup, Badge, Button, Dropdown, Row, Col } from 'react-bootstrap';
import { FileText, Edit } from 'lucide-react';
import { Link } from 'react-router-dom';

const ContractsPage = () => {
    const { user, axiosInstance } = useAuth();
    const [contracts, setContracts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchContracts = async () => {
            try {
                const response = await axiosInstance.get('/contracts/');
                setContracts(response.data.results || response.data);
            } catch (err) {
                setError('Failed to fetch contracts.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchContracts();
    }, [axiosInstance]);

    const handleStatusUpdate = async (contractId, newStatus) => {
        try {
            await axiosInstance.patch(`/contracts/${contractId}/update-status/`, { status: newStatus });
            // Refresh contracts
            const response = await axiosInstance.get('/contracts/');
            setContracts(response.data.results || response.data);
            alert('Contract status updated successfully!');
        } catch (err) {
            alert('Failed to update contract status.');
            console.error(err);
        }
    };

    const getStatusBadge = (status) => {
        const variants = {
            active: { bg: 'success', text: 'Active' },
            in_progress: { bg: 'warning', text: 'In Progress' },
            completed: { bg: 'primary', text: 'Completed' },
            cancelled: { bg: 'danger', text: 'Cancelled' }
        };
        const config = variants[status] || variants.active;
        return <Badge bg={config.bg}>{config.text}</Badge>;
    };

    if (loading) {
        return <Container className="text-center py-5"><Spinner animation="border" /></Container>;
    }

    if (error) {
        return <Container><Alert variant="danger">{error}</Alert></Container>;
    }

    return (
        <Container className="py-5 animate-fade-in">
            <h1 className="mb-4 gradient-text"><FileText className="me-2" />My Contracts</h1>
            {contracts.length > 0 ? (
                <Row className="g-4">
                    {contracts.map(contract => {
                        const projectTitle = typeof contract.project === 'object' ? contract.project.title : contract.project;
                        const freelancerName = typeof contract.freelancer === 'object' ? contract.freelancer.username : contract.freelancer;
                        return (
                            <Col md={6} key={contract.id}>
                                <Card className="shadow-sm h-100">
                                    <Card.Header className="d-flex justify-content-between align-items-center">
                                        <strong>{projectTitle}</strong>
                                        {getStatusBadge(contract.status || (contract.is_completed ? 'completed' : 'active'))}
                                    </Card.Header>
                                    <Card.Body>
                                        <p><strong>Freelancer:</strong> {freelancerName}</p>
                                        <p><strong>Agreed Rate:</strong> ₹{parseFloat(contract.agreed_rate).toFixed(2)}</p>
                                        <p><strong>Start Date:</strong> {new Date(contract.start_date).toLocaleDateString()}</p>
                                        {contract.end_date && (
                                            <p><strong>End Date:</strong> {new Date(contract.end_date).toLocaleDateString()}</p>
                                        )}
                                        <div className="mt-3">
                                            <Link to={`/project/${typeof contract.project === 'object' ? contract.project.id : contract.project}`} className="btn btn-outline-primary btn-sm me-2">
                                                View Project
                                            </Link>
                                            {(contract.status === 'active' || contract.status === 'in_progress') && (
                                                <Dropdown>
                                                    <Dropdown.Toggle variant="outline-secondary" size="sm" id={`status-dropdown-${contract.id}`}>
                                                        Update Status
                                                    </Dropdown.Toggle>
                                                    <Dropdown.Menu>
                                                        <Dropdown.Item onClick={() => handleStatusUpdate(contract.id, 'active')}>Set as Active</Dropdown.Item>
                                                        <Dropdown.Item onClick={() => handleStatusUpdate(contract.id, 'in_progress')}>Set as In Progress</Dropdown.Item>
                                                        <Dropdown.Item onClick={() => handleStatusUpdate(contract.id, 'completed')}>Mark as Completed</Dropdown.Item>
                                                    </Dropdown.Menu>
                                                </Dropdown>
                                            )}
                                        </div>
                                    </Card.Body>
                                </Card>
                            </Col>
                        );
                    })}
                </Row>
            ) : (
                <Alert variant="info">You have no contracts.</Alert>
            )}
        </Container>
    );
};

export default ContractsPage;
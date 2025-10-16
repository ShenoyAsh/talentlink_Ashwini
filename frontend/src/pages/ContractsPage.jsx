import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { Container, Card, Spinner, Alert, ListGroup, Badge } from 'react-bootstrap';

const ContractsPage = () => {
    const { axiosInstance } = useAuth();
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

    if (loading) {
        return <Container className="text-center py-5"><Spinner animation="border" /></Container>;
    }

    if (error) {
        return <Container><Alert variant="danger">{error}</Alert></Container>;
    }

    return (
        <Container className="py-5">
            <h1>My Contracts</h1>
            {contracts.length > 0 ? (
                <ListGroup>
                    {contracts.map(contract => (
                        <ListGroup.Item key={contract.id}>
                            <h5>{contract.project.title}</h5>
                            <p>Freelancer: {contract.freelancer.username}</p>
                            <p>Agreed Rate: ₹{contract.agreed_rate}</p>
                            <p>Start Date: {contract.start_date}</p>
                            <Badge bg={contract.is_completed ? "success" : "warning"}>
                                {contract.is_completed ? "Completed" : "In Progress"}
                            </Badge>
                        </ListGroup.Item>
                    ))}
                </ListGroup>
            ) : (
                <Alert variant="info">You have no contracts.</Alert>
            )}
        </Container>
    );
};

export default ContractsPage;
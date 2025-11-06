// frontend/src/pages/InvoicesPage.jsx
import React, { useState, useEffect } from 'react';
import { Container, Card, Table, Badge, Button, Modal, Form, Alert, Spinner } from 'react-bootstrap';
import { FileText, Plus, Download, CheckCircle } from 'lucide-react';
import { useAuth } from '../App';

const InvoicesPage = () => {
    const { user, axiosInstance } = useAuth();
    const [invoices, setInvoices] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ project: '', amount: '', tax_rate: '0', due_date: '', description: '' });
    const [error, setError] = useState('');

    useEffect(() => {
        fetchInvoices();
        if (user?.user_type === 'freelancer') {
            fetchProjects();
        }
    }, [user, axiosInstance]);

    const fetchInvoices = async () => {
        setLoading(true);
        try {
            const response = await axiosInstance.get('/invoices/');
            setInvoices(response.data.results || response.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchProjects = async () => {
        try {
            const response = await axiosInstance.get('/contracts/');
            const projectIds = (response.data.results || response.data).map(c => c.project.id);
            if (projectIds.length > 0) {
                const projectsData = await Promise.all(
                    projectIds.map(id => axiosInstance.get(`/projects/${id}/`).then(r => r.data))
                );
                setProjects(projectsData);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await axiosInstance.post('/invoices/', {
                ...formData,
                amount: parseFloat(formData.amount),
                tax_rate: parseFloat(formData.tax_rate)
            });
            setShowModal(false);
            setFormData({ project: '', amount: '', tax_rate: '0', due_date: '', description: '' });
            fetchInvoices();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to create invoice.');
        }
    };

    const getStatusBadge = (status) => {
        const variants = {
            draft: 'secondary',
            sent: 'info',
            paid: 'success',
            overdue: 'danger',
            cancelled: 'dark'
        };
        return <Badge bg={variants[status] || 'secondary'}>{status}</Badge>;
    };

    if (loading) return <Container className="text-center py-5"><Spinner animation="border" /></Container>;

    return (
        <Container className="py-5 animate-fade-in">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h1 className="gradient-text"><FileText className="me-2" />Invoices</h1>
                {user?.user_type === 'freelancer' && (
                    <Button variant="primary" onClick={() => setShowModal(true)}>
                        <Plus className="me-2" /> Create Invoice
                    </Button>
                )}
            </div>

            {error && <Alert variant="danger" onClose={() => setError('')} dismissible>{error}</Alert>}

            <Card className="shadow-sm">
                <Card.Body>
                    {invoices.length > 0 ? (
                        <Table responsive>
                            <thead>
                                <tr>
                                    <th>Invoice #</th>
                                    <th>Project</th>
                                    <th>Amount</th>
                                    <th>Total</th>
                                    <th>Due Date</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.map(inv => (
                                    <tr key={inv.id}>
                                        <td><strong>{inv.invoice_number}</strong></td>
                                        <td>{inv.project}</td>
                                        <td>₹{parseFloat(inv.amount).toFixed(2)}</td>
                                        <td className="fw-bold">₹{parseFloat(inv.total_amount).toFixed(2)}</td>
                                        <td>{new Date(inv.due_date).toLocaleDateString()}</td>
                                        <td>{getStatusBadge(inv.status)}</td>
                                        <td>
                                            <Button variant="outline-primary" size="sm">
                                                <Download size={16} />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    ) : (
                        <p className="text-muted text-center py-4">No invoices yet.</p>
                    )}
                </Card.Body>
            </Card>

            <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>Create Invoice</Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleSubmit}>
                    <Modal.Body>
                        <Form.Group className="mb-3">
                            <Form.Label>Project *</Form.Label>
                            <Form.Select
                                value={formData.project}
                                onChange={(e) => setFormData({...formData, project: e.target.value})}
                                required
                            >
                                <option value="">Select Project</option>
                                {projects.map(p => (
                                    <option key={p.id} value={p.id}>{p.title}</option>
                                ))}
                            </Form.Select>
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
                            <Form.Label>Tax Rate (%)</Form.Label>
                            <Form.Control
                                type="number"
                                step="0.01"
                                value={formData.tax_rate}
                                onChange={(e) => setFormData({...formData, tax_rate: e.target.value})}
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Due Date *</Form.Label>
                            <Form.Control
                                type="date"
                                value={formData.due_date}
                                onChange={(e) => setFormData({...formData, due_date: e.target.value})}
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
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
                        <Button variant="primary" type="submit">Create Invoice</Button>
                    </Modal.Footer>
                </Form>
            </Modal>
        </Container>
    );
};

export default InvoicesPage;


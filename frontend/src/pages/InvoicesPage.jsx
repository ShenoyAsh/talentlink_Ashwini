// frontend/src/pages/InvoicesPage.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { Container, Card, Table, Badge, Button, Modal, Form, Alert, Spinner, Dropdown } from 'react-bootstrap';
import { FileText, Plus, Download, CheckCircle, Edit, Send, Clock, XCircle } from 'lucide-react';

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
        if (!formData.project) {
            setError('Please select a project.');
            return;
        }
        if (!formData.amount || parseFloat(formData.amount) <= 0) {
            setError('Please enter a valid amount.');
            return;
        }
        if (!formData.due_date) {
            setError('Please select a due date.');
            return;
        }
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
        draft: { bg: 'secondary', icon: <Edit size={14} />, text: 'Draft' },
        sent: { bg: 'info', icon: <Send size={14} />, text: 'Sent' },
        paid: { bg: 'success', icon: <CheckCircle size={14} />, text: 'Paid' },
        overdue: { bg: 'danger', icon: <Clock size={14} />, text: 'Overdue' },
        cancelled: { bg: 'dark', icon: <XCircle size={14} />, text: 'Cancelled' }
    };
    const config = variants[status] || variants.draft;
    return (
        <Badge bg={config.bg} className="d-flex align-items-center" style={{ cursor: 'pointer' }}>
            {config.icon} <span className="ms-1">{config.text}</span>
        </Badge>
    );
};

const handleDownload = async (invoice) => {
    // Use the invoice object, especially invoice.invoice_number for the filename
    try {
        const response = await axiosInstance.get(`/invoices/${invoice.id}/download/`, {
            responseType: 'blob', // IMPORTANT: Tell axios to expect binary data
        });

        // Create a Blob from the PDF stream
        const file = new Blob(
            [response.data], 
            { type: 'application/pdf' }
        );

        // Create a link element, force the download
        const fileURL = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = fileURL;
        link.setAttribute('download', `invoice-${invoice.invoice_number}.pdf`);
        document.body.appendChild(link);
        link.click();

        // Clean up
        link.parentNode.removeChild(link);
        URL.revokeObjectURL(fileURL);

    } catch (err) {
        setError('Failed to download invoice. Please try again.');
        console.error(err);
    }
};

const handleStatusUpdate = async (invoiceId, newStatus) => {
        try {
            // This URL must match the @action in views.py
            await axiosInstance.patch(`/invoices/${invoiceId}/update-status/`, { status: newStatus });
            fetchInvoices(); // Refresh the list after update
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to update status.');
        }
    };

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
                                    <th>Invoice Number</th>
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

            {/* FIX 1: Use project_title, not project */}
            <td>{inv.project_title}</td>

            <td>₹{parseFloat(inv.amount).toFixed(2)}</td>
            <td className="fw-bold">₹{parseFloat(inv.total_amount).toFixed(2)}</td>

            {/* Fix for potentially null due_date */}
            <td>{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'N/A'}</td>

            {/* FIX 2: Status Dropdown */}
            <td>
                <Dropdown>
                    <Dropdown.Toggle as="div" style={{ border: 'none', background: 'transparent', padding: 0 }}>
                        {getStatusBadge(inv.status)}
                    </Dropdown.Toggle>
                    <Dropdown.Menu>
                        <Dropdown.Item onClick={() => handleStatusUpdate(inv.id, 'draft')}>
                            <Edit size={14} className="me-2" /> Mark as Draft
                        </Dropdown.Item>
                        <Dropdown.Item onClick={() => handleStatusUpdate(inv.id, 'sent')}>
                            <Send size={14} className="me-2" /> Mark as Sent
                        </Dropdown.Item>
                        <Dropdown.Item onClick={() => handleStatusUpdate(inv.id, 'paid')}>
                            <CheckCircle size={14} className="me-2" /> Mark as Paid
                        </Dropdown.Item>
                        <Dropdown.Item onClick={() => handleStatusUpdate(inv.id, 'overdue')}>
                            <Clock size={14} className="me-2" /> Mark as Overdue
                        </Dropdown.Item>
                        <Dropdown.Item onClick={() => handleStatusUpdate(inv.id, 'cancelled')}>
                            <XCircle size={14} className="me-2" /> Mark as Cancelled
                        </Dropdown.Item>
                    </Dropdown.Menu>
                </Dropdown>
            </td>

            {/* FIX 3: Download Button onClick */}
            <td>
               <Button variant="outline-primary" size="sm" onClick={() => handleDownload(inv)}>
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


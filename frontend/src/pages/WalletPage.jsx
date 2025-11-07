// frontend/src/pages/WalletPage.jsx
import React, { useState, useEffect } from 'react';
import { Container, Card, Row, Col, Button, Table, Badge, Modal, Form, Alert, Spinner } from 'react-bootstrap';
import { Wallet as WalletIcon, Plus, Minus, TrendingUp, History } from 'lucide-react';
// Note: useAuth should be exported from App.jsx
// For now, we'll import it directly - ensure App.jsx exports useAuth
import { useAuth } from '../App';

const WalletPage = () => {
    const { user, axiosInstance } = useAuth();
    const [wallet, setWallet] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showDepositModal, setShowDepositModal] = useState(false);
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [amount, setAmount] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    
    // --- FIX: Add loading states for modal forms ---
    const [isSubmitting, setIsSubmitting] = useState(false);


    useEffect(() => {
        fetchWalletData();
    }, [user, axiosInstance]);

    const fetchWalletData = async () => {
        if (!user) return;
        setLoading(true);
        try {
            // --- FIX: Fetch wallet and transactions in parallel ---
            const [walletRes, transactionsRes] = await Promise.all([
                axiosInstance.get('/wallet/'),
                axiosInstance.get('/transactions/')
            ]);
            
            // --- FIX: Handle paginated or single object response for wallet ---
            const walletData = walletRes.data.results ? walletRes.data.results[0] : walletRes.data[0];
            setWallet(walletData);
            
            setTransactions(transactionsRes.data.results || transactionsRes.data);
        } catch (err) {
            setError('Failed to fetch wallet data.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDeposit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setIsSubmitting(true); // --- FIX: Set loading state ---
        try {
            await axiosInstance.post('/transactions/', {
                transaction_type: 'deposit',
                amount: parseFloat(amount),
                description: `Deposit of ₹${amount}`
            });
            setSuccess(`Successfully deposited ₹${amount}`);
            setShowDepositModal(false);
            setAmount('');
            fetchWalletData(); // Refresh all data
        } catch (err) {
            // --- FIX: Provide detailed error messages ---
            const errorMsg = err.response?.data?.detail || err.response?.data?.amount || 'Failed to deposit.';
            setError(errorMsg);
        } finally {
            setIsSubmitting(false); // --- FIX: Unset loading state ---
        }
    };

    const handleWithdraw = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        
        if (parseFloat(amount) > wallet?.balance) {
            setError('Insufficient balance.');
            return;
        }
        
        setIsSubmitting(true); // --- FIX: Set loading state ---
        try {
            await axiosInstance.post('/transactions/', {
                transaction_type: 'withdrawal',
                amount: parseFloat(amount),
                description: `Withdrawal of ₹${amount}`
            });
            setSuccess(`Successfully withdrew ₹${amount}`);
            setShowWithdrawModal(false);
            setAmount('');
            fetchWalletData(); // Refresh all data
        } catch (err) {
            // --- FIX: Provide detailed error messages ---
            const errorMsg = err.response?.data?.detail || err.response?.data?.amount || 'Failed to withdraw.';
            setError(errorMsg);
        } finally {
            setIsSubmitting(false); // --- FIX: Unset loading state ---
        }
    };

    if (loading) return <Container className="text-center py-5"><Spinner animation="border" /></Container>;

    return (
        <Container className="py-5 animate-fade-in">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h1 className="gradient-text"><WalletIcon className="me-2" />My Wallet</h1>
            </div>

            {/* --- FIX: Make errors dismissible --- */}
            {error && <Alert variant="danger" onClose={() => setError('')} dismissible>{error}</Alert>}
            {success && <Alert variant="success" onClose={() => setSuccess('')} dismissible>{success}</Alert>}

            <Row className="g-4 mb-4">
                <Col md={6}>
                    <Card className="shadow-sm border-0">
                        <Card.Body className="p-4">
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <h5 className="mb-0">Current Balance</h5>
                                <WalletIcon size={32} className="text-primary" />
                            </div>
                            <h2 className="display-4 fw-bold text-success mb-0">
                                {/* --- FIX: Ensure wallet exists before accessing balance --- */}
                                ₹{wallet?.balance ? parseFloat(wallet.balance).toFixed(2) : '0.00'}
                            </h2>
                            <p className="text-muted mb-0 mt-2">Available for withdrawal</p>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={6}>
                    <Card className="shadow-sm border-0">
                        <Card.Body className="p-4">
                            <h5 className="mb-3">Quick Actions</h5>
                            <div className="d-grid gap-2">
                                <Button variant="primary" onClick={() => { setShowDepositModal(true); setError(''); setAmount(''); }}>
                                    <Plus size={18} className="me-2" /> Deposit Funds
                                </Button>
                                <Button variant="outline-primary" onClick={() => { setShowWithdrawModal(true); setError(''); setAmount(''); }}>
                                    <Minus size={18} className="me-2" /> Withdraw Funds
                                </Button>
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            <Card className="shadow-sm border-0">
                <Card.Header className="d-flex align-items-center">
                    <History className="me-2" /> Transaction History
                </Card.Header>
                <Card.Body>
                    {transactions.length > 0 ? (
                        <Table responsive>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Type</th>
                                    <th>Amount</th>
                                    <th>Description</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map(t => (
                                    <tr key={t.id}>
                                        <td>{new Date(t.created_at).toLocaleDateString()}</td>
                                        <td>
                                            <Badge bg={
                                                t.transaction_type === 'deposit' ? 'success' :
                                                t.transaction_type === 'withdrawal' ? 'warning' :
                                                t.transaction_type === 'payment' ? 'danger' :
                                                'info'
                                            }>
                                                {t.transaction_type}
                                            </Badge>
                                        </td>
                                        <td className={t.transaction_type === 'deposit' ? 'text-success' : 'text-danger'}>
                                            {t.transaction_type === 'deposit' ? '+' : '-'}₹{parseFloat(t.amount).toFixed(2)}
                                        </td>
                                        <td>{t.description || '-'}</td>
                                        <td><Badge bg="success">Completed</Badge></td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    ) : (
                        <p className="text-muted text-center py-4">No transactions yet.</p>
                    )}
                </Card.Body>
            </Card>

            {/* Deposit Modal */}
            <Modal show={showDepositModal} onHide={() => setShowDepositModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Deposit Funds</Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleDeposit}>
                    <Modal.Body>
                        {/* --- FIX: Show modal-specific errors --- */}
                        {error && <Alert variant="danger">{error}</Alert>}
                        <Form.Group className="mb-3">
                            <Form.Label>Amount (₹)</Form.Label>
                            <Form.Control
                                type="number"
                                step="0.01"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="Enter amount"
                                required
                                min="0.01"
                            />
                        </Form.Group>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={() => setShowDepositModal(false)} disabled={isSubmitting}>Cancel</Button>
                        <Button variant="primary" type="submit" disabled={isSubmitting}>
                            {isSubmitting ? <Spinner as="span" size="sm" /> : 'Deposit'}
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal>

            {/* Withdraw Modal */}
            <Modal show={showWithdrawModal} onHide={() => setShowWithdrawModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Withdraw Funds</Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleWithdraw}>
                    <Modal.Body>
                        {/* --- FIX: Show modal-specific errors --- */}
                        {error && <Alert variant="danger">{error}</Alert>}
                        <Alert variant="info">Available Balance: ₹{wallet?.balance ? parseFloat(wallet.balance).toFixed(2) : '0.00'}</Alert>
                        <Form.Group className="mb-3">
                            <Form.Label>Amount (₹)</Form.Label>
                            <Form.Control
                                type="number"
                                step="0.01"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="Enter amount"
                                required
                                min="0.01"
                                max={wallet?.balance || 0}
                            />
                        </Form.Group>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={() => setShowWithdrawModal(false)} disabled={isSubmitting}>Cancel</Button>
                        <Button variant="primary" type="submit" disabled={isSubmitting}>
                            {isSubmitting ? <Spinner as="span" size="sm" /> : 'Withdraw'}
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal>
        </Container>
    );
};

export default WalletPage;
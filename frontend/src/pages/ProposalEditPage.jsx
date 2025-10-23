// frontend/src/pages/ProposalEditPage.jsx
// This component might not be strictly necessary if editing is handled solely
// via the modal triggered from the dashboard. However, if you want a dedicated
// edit page, this is a basic structure.

import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Container, Card, Form, Button, Spinner, Alert } from 'react-bootstrap';
import { Save } from 'lucide-react';

// You might reuse the SubmitProposalModal logic directly or adapt it here
// For simplicity, let's assume we fetch the proposal and use a form similar to the modal

const ProposalEditPage = () => {
    const { id: proposalId } = useParams();
    const { user, axiosInstance } = useAuth();
    const navigate = useNavigate();

    const [proposal, setProposal] = useState(null);
    const [coverLetter, setCoverLetter] = useState('');
    const [proposedRate, setProposedRate] = useState('');
    const [timeAvailable, setTimeAvailable] = useState('');
    const [additionalInfo, setAdditionalInfo] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchProposal = async () => {
            setLoading(true);
            setError('');
             if (!user || user.user_type !== 'freelancer') {
                setError("Unauthorized access.");
                setLoading(false);
                return;
            }
            try {
                const response = await axiosInstance.get(`/proposals/${proposalId}/`);
                const data = response.data;

                // Security Check: Ensure user owns this proposal AND it's pending
                if (data.freelancer !== user.username) {
                    setError("You do not have permission to edit this proposal.");
                    setLoading(false);
                    return;
                }
                if (data.status !== 'pending') {
                     setError("This proposal cannot be edited as it is no longer pending.");
                     setLoading(false);
                     return;
                 }


                setProposal(data);
                setCoverLetter(data.cover_letter);
                setProposedRate(data.proposed_rate);
                setTimeAvailable(data.time_available || '');
                setAdditionalInfo(data.additional_info || '');

            } catch (err) {
                setError('Failed to fetch proposal details.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchProposal();
    }, [proposalId, user, axiosInstance]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await axiosInstance.put(`/proposals/${proposalId}/`, {
                 // Include project ID if required by PUT, might only need specific fields for PATCH
                 project: proposal.project, // Get project ID from fetched proposal
                 cover_letter: coverLetter,
                 proposed_rate: proposedRate,
                 time_available: timeAvailable,
                 additional_info: additionalInfo,
                 // DO NOT send status here
            });
            alert('Proposal updated successfully!');
            navigate('/dashboard'); // Go back to dashboard
        } catch (error) {
            setError(`Failed to update proposal: ${JSON.stringify(error.response?.data) || 'Server error'}`);
            console.error('Update proposal error:', error.response?.data || error.message);
        } finally {
            setLoading(false);
        }
    };

     if (loading && !proposal) {
        return <Container className="text-center py-5"><Spinner animation="border" /></Container>;
    }

    if (error) {
        return <Container className="py-5"><Alert variant="danger">{error}</Alert></Container>;
    }

     if (!proposal) {
         return <Container className="py-5"><Alert variant="warning">Proposal not found or access denied.</Alert></Container>;
     }

    return (
        <Container className="py-5">
             <Row className="justify-content-center">
                 <Col md={8}>
                     <h1>Edit Proposal for "{proposal?.project_title}"</h1>
                     <Card className="p-4 shadow-sm">
                        {error && !loading && <Alert variant="danger">{error}</Alert>}
                         <Form onSubmit={handleSubmit}>
                            <Form.Group className="mb-3">
                                <Form.Label>Cover Letter</Form.Label>
                                <Form.Control as="textarea" rows={5} value={coverLetter} onChange={e => setCoverLetter(e.target.value)} required/>
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>Your Proposed Rate (₹)</Form.Label>
                                <Form.Control type="number" step="0.01" value={proposedRate} onChange={e => setProposedRate(e.target.value)} required/>
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>Time Available</Form.Label>
                                <Form.Control type="text" value={timeAvailable} onChange={e => setTimeAvailable(e.target.value)} />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>Additional Information</Form.Label>
                                <Form.Control as="textarea" rows={3} value={additionalInfo} onChange={e => setAdditionalInfo(e.target.value)} />
                            </Form.Group>
                            <Button type="submit" variant="primary" disabled={loading}>
                                <Save size={16} className="me-1"/>
                                {loading ? <Spinner as="span" size="sm" /> : 'Update Proposal'}
                            </Button>
                             <Button variant="secondary" className="ms-2" onClick={() => navigate('/dashboard')}>
                                Cancel
                            </Button>
                        </Form>
                    </Card>
                 </Col>
            </Row>
        </Container>
    );
};

export default ProposalEditPage;
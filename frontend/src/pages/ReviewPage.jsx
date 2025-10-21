import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { useParams, useNavigate, Link } from 'react-router-dom'; // Import Link
import { Container, Card, Form, Button, Spinner, Alert, ListGroup, Badge } from 'react-bootstrap';
import { Star } from 'lucide-react'; // Import Star icon

// Use environment variable for API URL or default
const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const BASE_API_URL = `${API_URL}/api`;

const ReviewPage = () => {
    const { projectId } = useParams(); // projectId determines which project to review OR which project's reviews to view
    const { user, axiosInstance } = useAuth();
    const navigate = useNavigate();

    // State for submitting a new review
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [submitLoading, setSubmitLoading] = useState(false);
    const [submitError, setSubmitError] = useState('');

    // State for fetching existing reviews
    const [reviews, setReviews] = useState([]);
    const [fetchLoading, setFetchLoading] = useState(true);
    const [fetchError, setFetchError] = useState('');
    const [projectName, setProjectName] = useState(''); // To display project name

     // Fetch existing reviews for the specific project
    useEffect(() => {
        const fetchProjectAndReviews = async () => {
             if (!projectId) {
                setFetchError('Project ID is missing.');
                setFetchLoading(false);
                return; // Exit if no projectId
            }
            setFetchLoading(true);
            setFetchError('');
            try {
                 // Fetch project details to get the name
                 const projectRes = await axiosInstance.get(`/projects/${projectId}/`);
                 setProjectName(projectRes.data.title);

                // Fetch reviews filtered by the project ID
                const response = await axiosInstance.get(`/reviews/?project=${projectId}`);
                setReviews(response.data.results || response.data);
            } catch (err) {
                setFetchError('Failed to fetch reviews or project details.');
                console.error(err);
            } finally {
                setFetchLoading(false);
            }
        };

        fetchProjectAndReviews();
    }, [axiosInstance, projectId]); // Re-fetch if projectId changes

    const handleSubmit = async (e) => {
        e.preventDefault();
         if (!projectId) {
             setSubmitError('Cannot submit review without a project ID.');
             return;
         }
        setSubmitLoading(true);
        setSubmitError('');
        try {
            await axiosInstance.post('/reviews/', {
                project: projectId, // Ensure projectId is sent
                rating: parseInt(rating, 10), // Ensure rating is an integer
                comment,
            });
            alert('Review submitted successfully!');
            navigate('/dashboard'); // Or navigate back to project details or reviews list
        } catch (err) {
             const errorMsg = err.response?.data?.detail || err.response?.data?.[0] || 'Failed to submit review.';
             setSubmitError(errorMsg);
            console.error(err.response || err);
        } finally {
            setSubmitLoading(false);
        }
    };

    // Helper function to render stars
    const renderStars = (rating) => {
        return Array.from({ length: 5 }, (_, index) => (
            <Star key={index} size={18} color={index < rating ? "#ffc107" : "#e4e5e9"} fill={index < rating ? "#ffc107" : "none"} />
        ));
    };


    return (
        <Container className="py-5">
             {/* Conditionally render based on user role? Or project status? */}
             {/* Assuming users can review after a project is marked completed, */}
             {/* but for now, show the form always if projectId exists */}
             {projectId && (
                <Card className="mb-5 shadow-sm">
                    <Card.Header as="h2">Leave a Review for "{projectName || 'Project'}"</Card.Header>
                    <Card.Body>
                        {submitError && <Alert variant="danger">{submitError}</Alert>}
                        <Form onSubmit={handleSubmit}>
                            <Form.Group className="mb-3">
                                <Form.Label>Rating</Form.Label>
                                <Form.Select
                                    value={rating}
                                    onChange={(e) => setRating(e.target.value)}
                                    aria-label="Rating"
                                >
                                    <option value="5">5 - Excellent</option>
                                    <option value="4">4 - Good</option>
                                    <option value="3">3 - Average</option>
                                    <option value="2">2 - Fair</option>
                                    <option value="1">1 - Poor</option>
                                </Form.Select>
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>Comment</Form.Label>
                                <Form.Control
                                    as="textarea"
                                    rows={4}
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    required
                                    placeholder="Share your experience..."
                                />
                            </Form.Group>
                            <Button type="submit" disabled={submitLoading}>
                                {submitLoading ? <Spinner as="span" animation="border" size="sm" /> : 'Submit Review'}
                            </Button>
                        </Form>
                    </Card.Body>
                </Card>
             )}

            {/* Display Existing Reviews */}
            <h2 className="mb-4">Reviews for "{projectName || 'Project'}"</h2>
            {fetchLoading ? <Spinner animation="border" /> :
             fetchError ? <Alert variant="danger">{fetchError}</Alert> :
             reviews.length > 0 ? (
                <ListGroup>
                    {reviews.map(review => (
                        <ListGroup.Item key={review.id} className="mb-3 border rounded shadow-sm">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <div><strong>{review.reviewer}</strong> reviewed <strong>{review.reviewee}</strong></div>
                                <Badge bg="light" text="dark">{new Date(review.created_at).toLocaleDateString()}</Badge>
                            </div>
                             <div className="mb-2 d-flex align-items-center">
                                {renderStars(review.rating)} <span className="ms-2">({review.rating}/5)</span>
                             </div>
                            <p className="mb-0">{review.comment}</p>

                        </ListGroup.Item>
                    ))}
                </ListGroup>
            ) : (
                <Alert variant="info">No reviews found for this project yet.</Alert>
            )}
             <div className="mt-4">
                 <Link to="/projects">Back to Projects</Link> {/* Link back */}
             </div>
        </Container>
    );
};

export default ReviewPage;
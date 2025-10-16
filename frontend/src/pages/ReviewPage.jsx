import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Card, Form, Button, Spinner, Alert, ListGroup } from 'react-bootstrap';

const ReviewPage = () => {
    const { projectId } = useParams();
    const { axiosInstance } = useAuth();
    const navigate = useNavigate();
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchReviews = async () => {
            setLoading(true);
            try {
                const response = await axiosInstance.get('/reviews/');
                setReviews(response.data.results || response.data);
            } catch (err) {
                setError('Failed to fetch reviews.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchReviews();
    }, [axiosInstance]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await axiosInstance.post('/reviews/', {
                project: projectId,
                rating,
                comment,
            });
            navigate('/dashboard');
        } catch (err) {
            setError('Failed to submit review.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container className="py-5">
            <Card>
                <Card.Header><h2>Leave a Review</h2></Card.Header>
                <Card.Body>
                    {error && <Alert variant="danger">{error}</Alert>}
                    <Form onSubmit={handleSubmit}>
                        <Form.Group className="mb-3">
                            <Form.Label>Rating</Form.Label>
                            <Form.Control
                                as="select"
                                value={rating}
                                onChange={(e) => setRating(e.target.value)}
                            >
                                <option>5</option>
                                <option>4</option>
                                <option>3</option>
                                <option>2</option>
                                <option>1</option>
                            </Form.Control>
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Comment</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={4}
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                required
                            />
                        </Form.Group>
                        <Button type="submit" disabled={loading}>
                            {loading ? <Spinner as="span" animation="border" size="sm" /> : 'Submit Review'}
                        </Button>
                    </Form>
                </Card.Body>
            </Card>

            <h2 className="mt-5">All Reviews</h2>
            {loading ? <Spinner animation="border" /> : (
                <ListGroup>
                    {reviews.map(review => (
                        <ListGroup.Item key={review.id}>
                            <p><strong>Rating: </strong>{review.rating}/5</p>
                            <p>{review.comment}</p>
                            <footer className="blockquote-footer">
                                <cite title="Source Title">{review.reviewer}</cite>
                            </footer>
                        </ListGroup.Item>
                    ))}
                </ListGroup>
            )}
        </Container>
    );
};

export default ReviewPage;